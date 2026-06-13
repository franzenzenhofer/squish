/* The shipped-level contract: EVERY level in levels.json is proven solvable
   right here in CI - its recorded solution must replay move by move to a win,
   and par must equal the solution length. A level that cannot prove itself
   never ships. */
import { describe, expect, it } from 'vitest';
import { CODEDIR, cloneState, isWin, makeLevel } from '../src/engine/core';
import { move } from '../src/engine/move';
import type { DirCode, LevelDef } from '../src/engine/types';
import levels from '../src/levels.json';

describe('every shipped level is proven solvable', () => {
  const CURATED = levels as LevelDef[];

  it('has 50 levels (tutorials, intros, pairs, combos, the trio arc)', () => {
    expect(CURATED).toHaveLength(50);
  });

  CURATED.forEach((def, i) => {
    it('L' + (i + 1) + ': sol replays to a win in exactly par moves', () => {
      expect(def.sol, 'L' + (i + 1) + ' must carry its solution').toBeTruthy();
      const level = makeLevel(def);
      let st = cloneState(level.initState);
      const codes = (def.sol ?? '').split('') as DirCode[];
      expect(codes.length, 'par must equal the solution length').toBe(def.par);
      for (const c of codes) {
        const r = move(level, st, CODEDIR[c]);
        expect(r.moved, 'L' + (i + 1) + ' step ' + c + ' must move').toBe(true);
        st = r.state;
      }
      expect(isWin(level, st), 'L' + (i + 1) + ' solution must end on the heart').toBe(true);
    });
  });
});
