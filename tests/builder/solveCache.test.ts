/* Browser solvability cache for custom/editor levels. The key must be exact
   geometry (not par), order-insensitive, and bounded so localStorage does not
   grow forever. */
import { describe, expect, it, vi } from 'vitest';
import type { LevelDef } from '../../src/engine/types';
import {
  builderSolveCacheKey,
  getCachedSolve,
  setCachedSolve,
  solveWithBrowserCache,
  type CachedSolveInfo
} from '../../src/builder/solveCache';
import type { KV } from '../../src/builder/library';

function memKv(): KV {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); }
  };
}

const def: LevelDef = {
  w: 7,
  h: 7,
  target: [3, 0],
  dots: [[2, 2], [4, 2]],
  ice: [[2, 0], [4, 0], [2, 3], [4, 3], [1, 5], [3, 5], [5, 5]],
  chicks: [[3, 1], [2, 4], [4, 4]],
  par: 0
};

describe('builder solvability browser cache', () => {
  it('uses exact canonical geometry and ignores par', () => {
    const same: LevelDef = {
      ...def,
      par: 99,
      dots: [...def.dots].reverse(),
      ice: [...(def.ice ?? [])].reverse(),
      chicks: [...(def.chicks ?? [])].reverse()
    };
    const changed: LevelDef = { ...def, target: [0, 0] };

    expect(builderSolveCacheKey(def)).toBe(builderSolveCacheKey(same));
    expect(builderSolveCacheKey(def)).not.toBe(builderSolveCacheKey(changed));
  });

  it('stores and reads solvable verdicts for the exact board', () => {
    const kv = memKv();
    const info: CachedSolveInfo = { status: 'solvable', par: 10 };

    setCachedSolve(kv, def, info);
    expect(getCachedSolve(kv, def)).toEqual(info);
    expect(getCachedSolve(kv, { ...def, target: [0, 0] })).toBeNull();
  });

  it('wraps the async solver and skips repeated exact solves', async () => {
    const kv = memKv();
    const solve = vi.fn(async (): Promise<CachedSolveInfo> => ({ status: 'solvable', par: 10 }));

    await expect(solveWithBrowserCache(kv, def, solve)).resolves.toEqual({ status: 'solvable', par: 10 });
    await expect(solveWithBrowserCache(kv, def, solve)).resolves.toEqual({ status: 'solvable', par: 10 });
    expect(solve).toHaveBeenCalledOnce();
  });

  it('does not cache unknown results', async () => {
    const kv = memKv();
    const solve = vi.fn(async (): Promise<CachedSolveInfo> => ({ status: 'unknown', par: 0 }));

    await solveWithBrowserCache(kv, def, solve);
    await solveWithBrowserCache(kv, def, solve);
    expect(solve).toHaveBeenCalledTimes(2);
  });
});
