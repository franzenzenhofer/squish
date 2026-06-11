/* Budgeted level generation pipeline. Fully deterministic per level number:
   fixed attempt counts and state budgets (never wall-clock), so level N is
   identical for every player. Levels 1..3 are hand-made tutorials. */
import { DIRCODE, DIRNAMES, cloneState, makeLevel } from '../engine/core';
import { move } from '../engine/move';
import { featureUse, solve, spamSolvable } from '../engine/solve';
import type { Dir, Level, LevelDef } from '../engine/types';
import { FIELD_FLAGS, FRIEND_FLAGS, ramp, type RampParams } from './ramp';
import { levelRng, type Rng } from './rng';
import { sketch } from './sketch';

export const TUTORIALS: LevelDef[] = [
  {
    w: 4, h: 4, target: [1, 0], dots: [[1, 3]],
    par: 1, sol: 'U', cap: 'swipe! everybody slides'
  },
  {
    w: 4, h: 4, target: [3, 1], dots: [[0, 1], [1, 1]],
    par: 1, sol: 'R', cap: 'squishies merge - end with one on the heart'
  },
  {
    w: 4, h: 4, target: [3, 3], dots: [[0, 1], [0, 3]], walls: [[2, 1]],
    par: 2, sol: 'DR', cap: 'pillows are walls'
  }
];

interface Candidate {
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

/** How many opening swipes immediately kill every squishy. */
function suicideDirs(level: Level): number {
  let n = 0;
  for (const d of DIRNAMES) {
    const r = move(level, cloneState(level.initState), d);
    if (r.moved && r.state.dots.length === 0) n++;
  }
  return n;
}

function featuredOk(p: RampParams, used: Set<string>): boolean {
  for (const f of p.friends) {
    if (!FRIEND_FLAGS[f].some((flag) => used.has(flag))) return false;
  }
  for (const f of new Set(p.fields)) {
    if (!FIELD_FLAGS[f].some((flag) => used.has(flag))) return false;
  }
  return true;
}

function tryGenerate(rng: Rng, p: RampParams): Candidate | null {
  let best: Candidate | null = null;
  for (let a = 0; a < p.attempts; a++) {
    const def = sketch(rng, p);
    if (!def) continue;
    if (!reachable(def)) continue;
    const level = makeLevel(def);
    const res = solve(level, { maxStates: p.maxStates, maxDepth: p.parTarget + 3 });
    if (res.status !== 'solved') continue;
    if (res.par < p.parMin) continue;
    if (res.ways > 8) continue;
    if (suicideDirs(level) >= 2) continue;
    if (spamSolvable(level, res.par)) continue;
    const fu = featureUse(level, res.solution);
    if (!fu.win) continue;
    if (!featuredOk(p, fu.used)) continue;
    const score = res.par * 3 + fu.used.size * 2 - res.ways;
    if (best === null || score > best.score) {
      best = { def, par: res.par, ways: res.ways, solution: res.solution, score };
    }
    if (best.score >= p.parTarget * 3 + 4) break;
  }
  return best;
}

function simplify(p: RampParams): RampParams {
  return {
    ...p,
    fields: p.fields.slice(0, Math.max(0, p.fields.length - 1)),
    wallMax: Math.max(2, p.wallMax - 2),
    parTarget: Math.max(4, p.parTarget - 1),
    parMin: 4,
    attempts: Math.max(40, Math.floor(p.attempts / 2))
  };
}

function finalize(c: Candidate): LevelDef {
  return {
    ...c.def,
    par: c.par,
    sol: c.solution.map((d) => DIRCODE[d]).join('')
  };
}

/**
 * Deterministic level for number n (1-based). Levels 1..3 are tutorials;
 * everything after is generated, solver-verified, par >= 4, never with a
 * squishy on the heart. `fallbackPool` (proven levels) makes this total.
 */
export function generateLevel(n: number, fallbackPool?: LevelDef[]): LevelDef {
  if (n <= 3) return TUTORIALS[n - 1] as LevelDef;
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
