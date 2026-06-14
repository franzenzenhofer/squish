/* Persistence — what survives a reload is WHICH level you are on, plus your
   per-level best results and daily-best times. Mid-level progress is never
   stored: a reloaded or revisited level always starts fresh at its initial
   state. Finishing a level advances the saved resume pointer immediately (see
   saveAdvance), so quitting during the win card still resumes on the next
   level. Fail loud, never corrupt. */
import type { LevelDef } from '../engine/types';
import type { PlayTag, Session } from './session';

const KEY_V2 = 'squish-progress-v2';
const KEY_V1 = 'squish-progress-v1';
const KEY_DAYTOKEN = 'squish-daytoken-v1';

/** Today as YYYY-MM-DD in the player's LOCAL timezone (the player's "today"). */
function localDay(d = new Date()): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** A 12-char lowercase-alphanumeric random value (matches the schema token charset). */
function randomToken(rand: () => number = Math.random): string {
  let s = '';
  while (s.length < 12) s += Math.floor(rand() * 36).toString(36);
  return s.slice(0, 12);
}

/** The daily-rotating ANONYMOUS token (issue #6). A fresh random value is made
    once per calendar day and reused within the day; at the day boundary it is
    discarded and regenerated, so it can NEVER link a player across days. Stored
    under the squish-* prefix, so resetProgress() wipes it. This is deliberately
    NOT a persistent identifier — it only lets COUNT(DISTINCT) approximate daily
    unique players / restart-proof playstarts while staying consent-free. */
interface MiniStore { getItem(k: string): string | null; setItem(k: string, v: string): void; }

export function dailyToken(
  today = localDay(), rand: () => number = Math.random, store: MiniStore = localStorage
): string {
  try {
    const raw = store.getItem(KEY_DAYTOKEN);
    if (raw) {
      const cur = JSON.parse(raw) as { token?: string; day?: string };
      if (cur.day === today && cur.token) return cur.token;
    }
  } catch { /* unreadable — regenerate below */ }
  const token = randomToken(rand);
  try { store.setItem(KEY_DAYTOKEN, JSON.stringify({ token, day: today })); } catch { /* private mode: still return it */ }
  return token;
}

export interface SavedGame {
  v: 2;
  play: PlayTag;
  li: number;
  def: LevelDef | null;
  results: Record<number, number>;
  /** levels finished only with hint help — done, no hearts */
  hinted: Record<number, true>;
  daily: Record<string, number>;
}

const FRESH: SavedGame = {
  v: 2, play: { kind: 'campaign' }, li: 0, def: null, results: {}, hinted: {}, daily: {}
};

/** The snapshot that survives a reload (pure — no storage). ONLY a campaign play
    is a resume target: debug, custom, and daily plays coerce to the campaign
    pointer with no stored def, so a reload (or "Continue") always returns to the
    real campaign level, never a one-off that was last opened. */
export function resumeSnapshot(s: Session): SavedGame {
  const campaign = s.play.kind === 'campaign';
  return {
    v: 2,
    play: campaign ? s.play : { kind: 'campaign' },
    li: s.li,
    def: campaign ? s.def : null,
    results: s.results, hinted: s.hinted, daily: s.daily
  };
}

export function saveGame(s: Session): void {
  try {
    localStorage.setItem(KEY_V2, JSON.stringify(resumeSnapshot(s)));
  } catch {
    /* storage full or blocked — play on */
  }
}

/** Persist a finished campaign level by advancing the saved resume pointer to
    the next level, so a cold restart resumes there even if the player quits
    during the win card. Keeps results + daily bests; clears the stored def
    (the next level supplies its own). */
export function saveAdvance(s: Session, nextLi: number): void {
  const snap: SavedGame = {
    v: 2, play: { kind: 'campaign' }, li: nextLi, def: null,
    results: s.results, hinted: s.hinted, daily: s.daily
  };
  try {
    localStorage.setItem(KEY_V2, JSON.stringify(snap));
  } catch {
    /* storage full or blocked — play on */
  }
}

/** Reset EVERYTHING: progress, results, daily bests, the first-meet overlay
    flags (squishy-met-v2) AND the generated-level cache — every squishy key, so
    the game is truly fresh and all overlays greet again. One sweep means no key
    is ever forgotten (SSOT: match by prefix, not a hand-listed set). Used by the
    start screen's "Reset progress" link. */
export function resetProgress(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('squish-') || k.startsWith('squishy-'))) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* storage blocked — nothing to clear */
  }
}

function migrateV1(): SavedGame | null {
  try {
    const raw = localStorage.getItem(KEY_V1);
    if (!raw) return null;
    const p = JSON.parse(raw) as { li?: number; results?: Record<number, number> };
    localStorage.removeItem(KEY_V1);
    return { ...FRESH, li: p.li ?? 0, results: p.results ?? {} };
  } catch {
    return null;
  }
}

export function loadGame(): SavedGame {
  try {
    const raw = localStorage.getItem(KEY_V2);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SavedGame>;
      if (p.v === 2 && typeof p.li === 'number') {
        return {
          v: 2,
          /* daily is never a resume target — always resume the campaign pointer
             (a daily is reached only via its button or the #daily share link) */
          play: { kind: 'campaign' },
          li: p.li,
          def: p.def ?? null,
          results: p.results ?? {},
          hinted: p.hinted ?? {},
          daily: p.daily ?? {}
        };
      }
    }
  } catch {
    /* unreadable — fall through */
  }
  return migrateV1() ?? { ...FRESH };
}
