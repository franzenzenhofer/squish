/* Guards the shipped daily manifest (src/daily-verified.json). The client loads
   each day's board from this file to skip slow in-worker generation.

   Like the campaign ladder, these are treated as PINNED, pre-solved data: each
   day's `sol` is the cached result of its (one-time, sometimes 60-120s) solve.
   Solvability is proven by REPLAYING that baked solution to a win - instant, and
   it never re-derives anything, so editing a curated board (which can feed the
   rare daily fallback) doesn't force a 366-day re-bake. */
import { describe, expect, it } from 'vitest';
import manifest from '../src/daily-verified.json';
import { CODEDIR, cloneState, isWin, makeLevel } from '../src/engine/core';
import { move } from '../src/engine/move';
import type { DirCode, LevelDef } from '../src/engine/types';

const days = manifest.days as unknown as Record<string, LevelDef>;

describe('shipped daily manifest', () => {
  it('covers the full daily year with in-band, pre-solved levels', () => {
    const dates = Object.keys(days);
    expect(dates.length).toBeGreaterThanOrEqual(365);
    for (const date of dates) {
      const def = days[date] as LevelDef;
      expect(def.par, date).toBeGreaterThanOrEqual(7);
      expect(def.par, date).toBeLessThanOrEqual(10);
      expect(def.sol?.length, date).toBe(def.par);
    }
  });

  it('every day replays its baked solution to a win (cached: no re-solve)', () => {
    for (const [date, def] of Object.entries(days)) {
      const level = makeLevel(def);
      let st = cloneState(level.initState);
      for (const c of (def.sol ?? '').split('') as DirCode[]) {
        const r = move(level, st, CODEDIR[c]);
        expect(r.moved, date + ' step ' + c + ' must move').toBe(true);
        st = r.state;
      }
      expect(isWin(level, st), date + ' solution must end on the heart').toBe(true);
    }
  });
});
