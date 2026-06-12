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

export function saveGame(s: Session): void {
  /* debug test plays are never a resume target — persist the campaign pointer */
  const snap: SavedGame = {
    v: 2,
    play: s.play.kind === 'debug' ? { kind: 'campaign' } : s.play,
    li: s.li,
    def: s.play.kind === 'debug' ? null : s.def,
    results: s.results, hinted: s.hinted, daily: s.daily
  };
  try {
    localStorage.setItem(KEY_V2, JSON.stringify(snap));
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
          /* anything but a live daily (incl. a stray debug tag) resumes campaign */
          play: p.play?.kind === 'daily' ? p.play : { kind: 'campaign' },
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
