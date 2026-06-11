/* Session — the one shared mutable state of a running game, plus level
   sourcing (curated levels.json, then endless worker generation with a
   localStorage cache and one-level prefetch). */
import type { Oracle } from '../engine/analyze';
import { cloneState, makeLevel } from '../engine/core';
import type { Dir, DirCode, GameState, Level, LevelDef, MoverReport } from '../engine/types';
import curatedJson from '../levels.json';

export const CURATED: LevelDef[] = curatedJson as LevelDef[];

export interface AnimSeg {
  x0: number; y0: number; x1: number; y1: number;
  tp: boolean; hop: boolean; dur: number; dx: number; dy: number;
}

export interface AnimSprite {
  kind: string;
  end: string;
  stick: boolean;
  segs: AnimSeg[];
  cum: number[];
  total: number;
  fxq: Array<{ f: import('../engine/types').Fx; t: number; done: boolean }>;
  msteps: Array<{ t: number; m: number }>;
  t0: number;
  done: boolean;
  seed: number;
  lastX: number;
  lastY: number;
  lastDx: number;
  lastDy: number;
  endCell: { x: number; y: number };
  appear?: boolean;
}

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  t0: number; dur: number; col: string; shape: 'heart' | 'star' | 'dot'; s: number;
}

export interface Pulse {
  type: 'pop' | 'squash' | 'chomp' | 'sink' | 'shake' | 'soar' | 'ring';
  key?: string;
  axis?: 'x' | 'y';
  t0: number;
  dur: number;
  amp?: number;
  x?: number;
  y?: number;
  r?: number;
  kind?: string;
}

export interface Ambient {
  x: number; y: number; v: number; ph: number; s: number; star: boolean;
}

export type Mode = 'idle' | 'anim' | 'ohno' | 'win' | 'lose' | 'loading';

/** What is being played — the campaign ladder or a dated daily puzzle. */
export type PlayTag = { kind: 'campaign' } | { kind: 'daily'; date: string };

export interface Session {
  li: number;
  def: LevelDef;
  level: Level;
  gs: GameState;
  moves: number;
  hist: Array<{ gs: GameState; moves: number }>;
  /** the swipes played so far in this level — replayed to restore a session */
  line: DirCode[];
  play: PlayTag;
  mode: Mode;
  pending: Dir | null;
  results: Record<number, number>;
  /** best move counts for completed daily puzzles, keyed by date */
  daily: Record<string, number>;
  sprites: AnimSprite[];
  particles: Particle[];
  pulses: Pulse[];
  ambients: Ambient[];
  renderBroken: Set<string>;
  renderFed: Set<string>;
  renderStars: Set<string>;
  cell: number;
  ox: number;
  oy: number;
  cssSize: number;
  dpr: number;
  winTimer: number | null;
  capTimer: number | null;
  combo: number;
  winFace: boolean;
  boardScale: number;
  /** full solved state graph of the current level (worker-provided) */
  oracle: Oracle | null;
  /** assist cache key the oracle belongs to ('lvl:<li>' / 'daily:<date>') */
  oracleKey: string | null;
  hintMode: boolean;
  hintDir: Dir | null;
  hintT0: number;
  /** movers of the last executed swipe — fuels the oh-no reverse hop */
  lastMovers: MoverReport[] | null;
  ohNoShown: boolean;
  /** squishies wear the worried face while the oh-no plays */
  ohNoFace: boolean;
  /** the running anim is the oh-no reverse hop, not a player move */
  ohNoReturn: boolean;
  /** start of the heart-unlock animation (last star collected), or null */
  heartUnlockT0: number | null;
}

const GEN_KEY = 'squish-gen-v1:';

export function blankSession(): Session {
  const def = CURATED[0] as LevelDef;
  return {
    li: 0, def, level: makeLevel(def), gs: cloneState(makeLevel(def).initState),
    moves: 0, hist: [], line: [], play: { kind: 'campaign' },
    mode: 'idle', pending: null, results: {}, daily: {},
    sprites: [], particles: [], pulses: [], ambients: [],
    renderBroken: new Set(), renderFed: new Set(), renderStars: new Set(),
    cell: 0, ox: 0, oy: 0, cssSize: 0, dpr: 1,
    winTimer: null, capTimer: null, combo: 0, winFace: false, boardScale: 1,
    oracle: null, oracleKey: null, hintMode: false,
    hintDir: null, hintT0: 0, lastMovers: null,
    ohNoShown: false, ohNoFace: false, ohNoReturn: false, heartUnlockT0: null
  };
}

export function cachedGenLevel(n: number): LevelDef | null {
  try {
    const raw = localStorage.getItem(GEN_KEY + n);
    if (raw) return JSON.parse(raw) as LevelDef;
  } catch {
    /* regenerate */
  }
  return null;
}

export function cacheGenLevel(n: number, def: LevelDef): void {
  try {
    localStorage.setItem(GEN_KEY + n, JSON.stringify(def));
  } catch {
    /* cache is an optimization only */
  }
}
