/* The total, deterministic fallback bake — the guard that makes "stuck then
   crash" impossible. descend() must ALWAYS return a proven, trap-free, solvable
   board for a rung the strict generator cannot bake (e.g. level 61), and must
   be deterministic. pickByPar() must choose the closest-difficulty proven
   level. These are the safety net behind the prebaked manifest and the live
   10s watchdog. */
import { describe, expect, it } from 'vitest';
import { makeLevel } from '../src/engine/core';
import { solve, featureUse } from '../src/engine/solve';
import { trapFree } from '../src/gen/generate';
import { ramp } from '../src/gen/ramp';
import { descendLevel, pickByPar } from '../src/lib/safeBake';
import type { LevelDef } from '../src/engine/types';

describe('safeBake.descendLevel', () => {
  it('bakes level 61 (the stuck rung) into a proven solvable trap-free board', () => {
    const def = descendLevel(61, ramp(61));
    expect(def).not.toBeNull();
    const level = makeLevel(def as LevelDef);
    const res = solve(level, { maxStates: 300000, maxDepth: 40 });
    expect(res.status).toBe('solved');
    expect((def as LevelDef).par).toBeGreaterThanOrEqual(7);
    expect((def as LevelDef).sol?.length).toBe((def as LevelDef).par);
    expect(trapFree(def as LevelDef)).toBe(true);
    /* the optimal line really plays to a win */
    if (res.status === 'solved') {
      const fu = featureUse(level, res.solution);
      expect(fu.win).toBe(true);
    }
  }, 120000);

  it('is deterministic: same rung yields the identical board', () => {
    const a = descendLevel(61, ramp(61));
    const b = descendLevel(61, ramp(61));
    expect(a).toEqual(b);
  }, 120000);
});

describe('safeBake.pickByPar', () => {
  const pool: LevelDef[] = [
    { w: 5, h: 5, target: [0, 0], dots: [[1, 1]], par: 8, sol: '' },
    { w: 6, h: 6, target: [0, 0], dots: [[1, 1]], par: 14, sol: '' },
    { w: 7, h: 7, target: [0, 0], dots: [[1, 1]], par: 22, sol: '' }
  ];
  it('picks the proven level closest in par to the target difficulty', () => {
    expect(pickByPar(pool, 15)?.par).toBe(14);
    expect(pickByPar(pool, 30)?.par).toBe(22);
    expect(pickByPar(pool, 7)?.par).toBe(8);
  });
  it('returns null for an empty pool', () => {
    expect(pickByPar([], 10)).toBeNull();
  });
});
