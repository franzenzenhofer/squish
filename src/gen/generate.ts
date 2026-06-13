/* Budgeted level generation pipeline. Fully deterministic per level number:
   fixed attempt counts and state budgets (never wall-clock), so level N is
   identical for every player. Levels 1..3 are hand-made tutorials. */
import { analyzeLevel, winnableState } from '../engine/analyze';
import { DIRCODE, DIRNAMES, cloneState, makeLevel, ser } from '../engine/core';
import { move } from '../engine/move';
import { featureUse, solve, spamSolvable } from '../engine/solve';
import { FRIEND_KEYS } from '../engine/types';
import type { Dir, GameState, Level, LevelDef, XY } from '../engine/types';
import { CAMPAIGN_END, FIELD_FLAGS, FRIEND_FLAGS, ramp, type RampParams } from './ramp';
import { levelRng, type Rng } from './rng';
import { sketch } from './sketch';

export const TUTORIALS: LevelDef[] = [
  {
    w: 4, h: 4, target: [1, 0], dots: [[1, 3]],
    par: 1, sol: 'U', cap: 'Swipe - Squishy & Friends slide'
  },
  {
    w: 4, h: 4, target: [3, 1], dots: [[0, 1], [1, 1]],
    par: 1, sol: 'R', cap: 'Squishies merge - end with one on the heart'
  },
  {
    /* no caption: pillows (walls) are explained by their overlay, not a bubble */
    w: 4, h: 4, target: [3, 3], dots: [[0, 1], [0, 3]], walls: [[2, 1]],
    par: 2, sol: 'DR'
  }
];

/* Hand-authored feature-intro levels that must demonstrate a mechanic exactly.
   The generator's minimality pass would strip a purely-teaching obstacle, so
   these are returned as-is and skipped by minimize in build-levels. Level 5
   shows the bunny RUNNING right and hopping over a pillow (the wall at 1,2 and
   3,4 sit in its run, cleared mid-hop). Heart on row 0 - nothing above it. */
export const FIXED_LEVELS: Record<number, LevelDef> = {
  5: {
    /* no caption: the bunny is explained by its overlay, not a bubble */
    w: 5, h: 5, target: [4, 0], dots: [[0, 4]], bunnies: [[0, 2]],
    walls: [[1, 2], [0, 1], [3, 4]],
    par: 5, sol: 'RULDR'
  }
};

export interface Candidate {
  def: LevelDef;
  par: number;
  ways: number;
  solution: Dir[];
  score: number;
}

/** Cheap necessary condition: every squishy can floor-reach the heart
    (walls block; portals add an edge; skipped when jelly can hop walls). */
function reachable(def: LevelDef): boolean {
  if (def.jelly && def.jelly.length > 0) return true;
  const wall = new Set((def.walls ?? []).map((c) => c[0] + ',' + c[1]));
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [def.target];
  seen.add(def.target[0] + ',' + def.target[1]);
  const portals = def.portals;
  while (queue.length > 0) {
    const [x, y] = queue.shift() as [number, number];
    const steps: Array<[number, number]> = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    if (portals) {
      const [a, b] = portals;
      if (x === a[0] && y === a[1]) steps.push([b[0], b[1]]);
      if (x === b[0] && y === b[1]) steps.push([a[0], a[1]]);
    }
    for (const [nx, ny] of steps) {
      const k = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx >= def.w || ny >= def.h || wall.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return def.dots.every((d) => seen.has(d[0] + ',' + d[1]));
}

/** Mover arrays whose pieces must never spawn above the heart (with dots). */
const MOVER_KEYS = ['boxes', 'balloons', 'snails'] as const;

/** No actor may spawn on a row above the heart: every squishy, friend and
    mover needs y >= target[1] ("above" = a smaller row index). Stars are
    pickups, not actors, so they are exempt. */
export function noAboveHeart(def: LevelDef): boolean {
  const ty = def.target[1];
  const pieces: XY[] = [...def.dots];
  for (const key of MOVER_KEYS) pieces.push(...(def[key] ?? []));
  for (const key of FRIEND_KEYS) pieces.push(...(def[key] ?? []));
  return pieces.every((c) => c[1] >= ty);
}

/** How many opening swipes immediately kill every squishy. */
function suicideDirs(level: Level): number {
  let n = 0;
  for (const d of DIRNAMES) {
    const r = move(level, cloneState(level.initState), d);
    if (r.moved && r.state.dots.length === 0) n++;
  }
  return n;
}

export function featuredOk(p: RampParams, used: Set<string>): boolean {
  let hits = 0;
  let groups = 0;
  for (const f of p.friends) {
    groups++;
    if (FRIEND_FLAGS[f].some((flag) => used.has(flag))) hits++;
  }
  for (const f of new Set(p.fields)) {
    groups++;
    if (FIELD_FLAGS[f].some((flag) => used.has(flag))) hits++;
  }
  return hits >= Math.min(groups, p.featureUseMin ?? groups);
}

/** All states reachable within `depth` swipes of the start. */
function nearStates(level: Level, depth: number): GameState[] {
  let frontier: GameState[] = [cloneState(level.initState)];
  const seen = new Set<string>([ser(level.initState)]);
  const out: GameState[] = [];
  for (let d = 0; d < depth; d++) {
    const next: GameState[] = [];
    for (const st of frontier) {
      for (const dir of DIRNAMES) {
        const r = move(level, st, dir);
        if (!r.moved || r.state.dots.length === 0) continue;
        const k = ser(r.state);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(r.state);
        next.push(r.state);
      }
    }
    frontier = next;
  }
  return out;
}

/** No board may punish within the first two swipes: every state reachable in
    <= `depth` moves must stay winnable, and the full graph must be
    exhaustible (so the in-game oracle never has blind spots). */
export function trapFree(def: LevelDef, depth = 2): boolean {
  const level = makeLevel(def);
  const oracle = analyzeLevel(level);
  if (!oracle.exhausted) return false;
  for (const st of nearStates(level, depth)) {
    if (winnableState(oracle, ser(st)) === false) return false;
  }
  return true;
}

/** Cheap pre-filter: a small budgeted solve from every near-start state.
    Catches PROVEN traps fast; 'unknown' passes (the full trapFree gate on
    the final winner still guarantees correctness). */
function quickTrapScan(level: Level, par: number, depth = 2): boolean {
  for (const st of nearStates(level, depth)) {
    const r = solve(level, { maxStates: 6000, maxDepth: par + 4, deadlineMs: 40 }, st);
    if (r.status === 'unsolvable') return false;
  }
  return true;
}

export function tryGenerate(rng: Rng, p: RampParams): Candidate | null {
  const pool: Candidate[] = [];
  /* exact mode (the endless ladder) must see its whole acceptance band — a
     candidate whose par exceeds the depth cap comes back 'unknown' and is
     wasted. Other callers (dailies, curated builds, bakes) keep the original
     depth EXACTLY: the daily is deterministic per date for every player, and
     a deeper search would silently change which level a date produces. */
  const maxDepth = p.parPrefer === 'exact'
    ? Math.max(p.parTarget + 3, p.parMax + 1)
    : p.parTarget + 3;
  for (let a = 0; a < p.attempts; a++) {
    const def = sketch(rng, p);
    if (!def) continue;
    if (!reachable(def)) continue;
    const level = makeLevel(def);
    const res = solve(level, { maxStates: p.maxStates, maxDepth });
    if (res.status !== 'solved') continue;
    if (!noAboveHeart(def)) continue;
    if (res.par < p.parMin || res.par > p.parMax) continue;
    if (res.ways > 8) continue;
    if (suicideDirs(level) >= 2) continue;
    if (spamSolvable(level, res.par)) continue;
    const fu = featureUse(level, res.solution);
    if (!fu.win) continue;
    if (!featuredOk(p, fu.used)) continue;
    /* 'max' chases the hardest candidate; 'exact' (the endless ladder) wants
       the one closest above the rung so the curve stays smooth */
    const parScore = p.parPrefer === 'exact'
      ? (p.parTarget - (res.par - p.parTarget)) * 3
      : res.par * 3;
    const score = parScore + fu.used.size * 2 - res.ways;
    pool.push({ def, par: res.par, ways: res.ways, solution: res.solution, score });
    const goodEnough = p.parPrefer === 'exact'
      ? res.par <= p.parTarget + 1
      : score >= p.parTarget * 3 + 4;
    if (goodEnough && quickTrapScan(level, res.par) && trapFree(def)) {
      return pool[pool.length - 1] as Candidate;
    }
  }
  /* best-scoring candidate that doesn't punish within the opening swipes:
     cheap budgeted scan filters the pool, the expensive full-graph proof
     runs on at most a few finalists */
  pool.sort((a, b) => b.score - a.score);
  let fullChecks = 0;
  for (const c of pool) {
    if (!quickTrapScan(makeLevel(c.def), c.par)) continue;
    if (fullChecks >= 3) break;
    fullChecks++;
    if (trapFree(c.def)) return c;
  }
  return null;
}

function simplify(p: RampParams): RampParams {
  const parTarget = Math.max(4, p.parTarget - 1);
  return {
    ...p,
    fields: p.fields.slice(0, Math.max(0, p.fields.length - 1)),
    wallMax: Math.max(2, p.wallMax - 2),
    parTarget,
    parMax: parTarget + (p.parMax - p.parTarget),
    parMin: 4,
    attempts: Math.max(40, Math.floor(p.attempts / 2))
  };
}

export function finalize(c: Candidate): LevelDef {
  return {
    ...c.def,
    par: c.par,
    sol: c.solution.map((d) => DIRCODE[d]).join('')
  };
}

/** The proven high-par cast (parlab, 2026-06-12): a star tour with bunny +
    frog in a wall maze reaches par 25-34 within a few hundred cheap attempts
    — the rescue rounds reach for it before EVER relaxing a par floor. */
function rescueParams(p: RampParams): RampParams {
  return {
    ...p,
    friends: ['star', 'bunny', 'frog'],
    starMax: Math.max(3, p.starMax ?? 2),
    wallMax: Math.max(12, p.wallMax),
    featureUseMin: 2
  };
}

/** Endless levels NEVER step back: rescue rounds keep the par floor (fresh
    seeds, then the proven star-tour cast) and concede at most ONE breathing
    notch — simplify(), which resets floors, is never used here. The trio arc
    (41-50) keeps its PRE-PLANNED cast in every round: offline builds either
    deliver Franz's trios at their rungs or fail loud for a cast fix. */
function generateEndless(n: number, fallbackPool?: LevelDef[]): LevelDef {
  const p = ramp(n);
  const rounds: Array<[number, RampParams]> = n <= CAMPAIGN_END ? [
    [n, p],
    [n * 7919 + 101, p],
    [n * 104729 + 7, p],
    [n * 999983 + 13, p]
  ] : [
    [n, p],
    [n * 7919 + 101, p],
    [n * 104729 + 7, rescueParams(p)],
    [n * 999983 + 13, { ...rescueParams(p), parMin: p.parMin - 1 }]
  ];
  for (const [seed, q] of rounds) {
    const c = tryGenerate(levelRng(seed), q);
    if (c) return finalize(c);
  }
  console.error('[squishy] endless generation exhausted every rescue round for n=' + n);
  if (fallbackPool && fallbackPool.length > 0) {
    return fallbackPool[n % fallbackPool.length] as LevelDef;
  }
  throw new Error('level generation failed for n=' + n);
}

/**
 * Deterministic level for number n (1-based). Levels 1..3 are tutorials;
 * everything after is generated, solver-verified, par >= 4, never with a
 * squishy on the heart. `fallbackPool` (proven levels) makes this total.
 */
export function generateLevel(n: number, fallbackPool?: LevelDef[]): LevelDef {
  if (n <= 3) return TUTORIALS[n - 1] as LevelDef;
  const fixed = FIXED_LEVELS[n];
  if (fixed) return fixed;
  if (n > 40) return generateEndless(n, fallbackPool);
  const rng = levelRng(n);
  let p = ramp(n);
  for (let round = 0; round < 3; round++) {
    const c = tryGenerate(rng, p);
    if (c) return finalize(c);
    p = simplify(p);
  }
  if (fallbackPool && fallbackPool.length > 0) {
    return fallbackPool[n % fallbackPool.length] as LevelDef;
  }
  throw new Error('level generation failed for n=' + n);
}
