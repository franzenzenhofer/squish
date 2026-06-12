/* Persistence — the whole running game survives a reload. The level def and
   the line of swipes played are stored; on boot the line is replayed through
   the engine, reconstructing the exact state AND the undo stack. A line that
   no longer replays (engine changed) is discarded and the level starts
   fresh — loud, never corrupt. */
import { CODEDIR, cloneState } from '../engine/core';
import { move } from '../engine/move';
import type { DirCode, GameState, Level, LevelDef } from '../engine/types';
import type { PlayTag, Session } from './session';

const KEY_V2 = 'squish-progress-v2';
const KEY_V1 = 'squish-progress-v1';

export interface SavedGame {
  v: 2;
  play: PlayTag;
  li: number;
  def: LevelDef | null;
  line: string;
  results: Record<number, number>;
  daily: Record<string, number>;
}

const FRESH: SavedGame = {
  v: 2, play: { kind: 'campaign' }, li: 0, def: null, line: '', results: {}, daily: {}
};

export function saveGame(s: Session): void {
  const snap: SavedGame = {
    v: 2, play: s.play, li: s.li, def: s.def,
    line: s.line.join(''), results: s.results, daily: s.daily
  };
  try {
    localStorage.setItem(KEY_V2, JSON.stringify(snap));
  } catch {
    /* storage full or blocked — play on */
  }
}

/** Wipe campaign progress, results and daily-best times (keeps friend-met
    flags). Used by the start screen's "Reset progress" link. */
export function resetProgress(): void {
  try {
    localStorage.removeItem(KEY_V2);
    localStorage.removeItem(KEY_V1);
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
          play: p.play?.kind === 'daily' ? p.play : { kind: 'campaign' },
          li: p.li,
          def: p.def ?? null,
          line: typeof p.line === 'string' ? p.line : '',
          results: p.results ?? {},
          daily: p.daily ?? {}
        };
      }
    }
  } catch {
    /* unreadable — fall through */
  }
  return migrateV1() ?? { ...FRESH };
}

export interface Replayed {
  gs: GameState;
  hist: Array<{ gs: GameState; moves: number }>;
  line: DirCode[];
  moves: number;
}

/** Replay a DirCode line from the level start. Null = line does not replay
    (engine or level changed since the save). */
export function replayLine(level: Level, line: string): Replayed | null {
  const codes = line.split('') as DirCode[];
  let gs = cloneState(level.initState);
  const hist: Replayed['hist'] = [];
  const played: DirCode[] = [];
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i] as DirCode;
    if (!(c in CODEDIR)) return null;
    const r = move(level, gs, CODEDIR[c]);
    if (!r.moved) return null;
    hist.push({ gs, moves: i });
    gs = r.state;
    played.push(c);
    if (gs.dots.length === 0) return null; // saved mid-lose? start fresh
  }
  return { gs, hist, line: played, moves: played.length };
}

/** Apply a replayed line onto a freshly applied level. */
export function restoreReplay(s: Session, rp: Replayed): void {
  s.gs = rp.gs;
  s.hist = rp.hist;
  s.line = rp.line;
  s.moves = rp.moves;
  s.renderBroken = new Set(s.gs.broken);
  s.renderFed = new Set(s.gs.fed);
  s.renderStars = new Set(s.gs.stars);
}

/** True when the saved level def matches the current curated def — a changed
    def means the save's line belongs to an older build of the level. */
export function sameDef(a: LevelDef | null, b: LevelDef): boolean {
  return a !== null && JSON.stringify(a) === JSON.stringify(b);
}
