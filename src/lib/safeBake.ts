/* Total, deterministic fallback bake. The endless generator can fail to produce
   an on-rung board when a cast's state graph is too large for the oracle to
   exhaust within budget - trapFree then rejects EVERY candidate, so the board
   never bakes. That is the root cause of the level-61 "stuck then crash": the
   worker churns for minutes and the player waits on a board that will never
   come. This module guarantees a bake: it relaxes toward a small, always-
   exhaustible regime in fixed deterministic steps and takes the first proven,
   trap-free board - staying as close to the rung's difficulty as the engine can
   actually carry. Pure (seeded + budgeted): same n -> same level, never
   wall-clock dependent, so it is safe to prebake and reproduce. */
import type { LevelDef } from '../engine/types';
import { type Candidate, finalize, tryGenerate } from '../gen/generate';
import { type RampParams } from '../gen/ramp';
import { levelRng } from '../gen/rng';

const MIN_BOARD = 5;
const PAR_FLOOR = 7;
const STATE_FLOOR = 20000;
const DESCENT_STEPS = 12;

/** One relaxation step toward a smaller, faster, always-exhaustible regime:
    shrink the board, clamp the state budget LOW (so the oracle exhausts fast and
    sprawling boards fail the solve quickly), shed a field then friends, and ease
    par toward the floor PROPORTIONALLY - a par-30 marathon rung must reach a
    bakeable regime in as few steps as a par-14 rung, so the fallback is fast for
    every level. 'max' keeps the hardest board the small regime can still carry. */
function relax(p: RampParams, step: number): RampParams {
  const friends = step >= 4 ? p.friends.slice(0, 1) : step >= 2 ? p.friends.slice(0, 2) : p.friends;
  const drop = Math.max(1, Math.ceil((p.parTarget - PAR_FLOOR) / 4));
  const parTarget = Math.max(PAR_FLOOR, p.parTarget - drop);
  return {
    ...p,
    w: Math.max(MIN_BOARD, p.w - 1),
    h: Math.max(MIN_BOARD, p.h - 1),
    maxStates: STATE_FLOOR,
    fields: step >= 1 ? p.fields.slice(0, Math.max(0, p.fields.length - 1)) : p.fields,
    friends,
    parTarget,
    parMin: PAR_FLOOR,
    parMax: parTarget + 2,
    attempts: Math.max(200, p.attempts),
    featureUseMin: 1,
    parPrefer: 'max'
  };
}

/** Guaranteed deterministic candidate at (or just below) the rung. Returns the
    first proven, trap-free board found while relaxing; null only if even the
    smallest regime yields nothing (caller then uses a proven pool). */
export function descend(n: number, base: RampParams): Candidate | null {
  let q: RampParams = { ...base, featureUseMin: 1 };
  for (let step = 0; step < DESCENT_STEPS; step++) {
    q = relax(q, step);
    const c = tryGenerate(levelRng(n * 7919 + step * 31 + 17), q);
    if (c) return c;
  }
  return null;
}

/** Finalized deterministic descent level (par + sol baked in), or null. */
export function descendLevel(n: number, base: RampParams): LevelDef | null {
  const c = descend(n, base);
  return c ? finalize(c) : null;
}

/** Pick the proven level whose par is closest to the target difficulty - the
    same-difficulty fallback used when a live bake is too slow. Pure and
    deterministic (closest par; tie -> the earlier entry) so every device
    agrees on the fallback for a given level. */
export function pickByPar(levels: LevelDef[], targetPar: number): LevelDef | null {
  let best: LevelDef | null = null;
  let bestGap = Infinity;
  for (const def of levels) {
    const gap = Math.abs(def.par - targetPar);
    if (gap < bestGap) { bestGap = gap; best = def; }
  }
  return best;
}
