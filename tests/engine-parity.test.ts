/* Parity with the verified v3 engine: every original level's recorded optimal
   solution must still win in exactly `par` moves, and the BFS must agree. */
import { describe, expect, it } from 'vitest';
import { CODEDIR, cloneState, isWin, makeLevel } from '../src/engine/core';
import { move } from '../src/engine/move';
import { solve } from '../src/engine/solve';
import type { DirCode, LevelDef } from '../src/engine/types';
import levelsV3 from './fixtures/levels-v3.json';

const LEVELS = levelsV3 as LevelDef[];

describe('v3 level parity', () => {
  it('has the full original set', () => {
    expect(LEVELS.length).toBe(60);
  });

  for (let i = 0; i < LEVELS.length; i++) {
    const def = LEVELS[i] as LevelDef;
    it(`level ${i + 1}: recorded sol wins in par=${def.par}`, () => {
      const level = makeLevel(def);
      let st = cloneState(level.initState);
      const sol = (def.sol ?? '').split('') as DirCode[];
      expect(sol.length).toBe(def.par);
      for (const c of sol) {
        const r = move(level, st, CODEDIR[c]);
        expect(r.moved).toBe(true);
        st = r.state;
      }
      expect(isWin(level, st)).toBe(true);
    });
  }

  it('BFS par matches recorded par on a sample', () => {
    for (const i of [0, 5, 11, 21, 33, 41, 50, 59]) {
      const def = LEVELS[i] as LevelDef;
      const res = solve(makeLevel(def), { maxDepth: def.par + 1 });
      expect(res.status, `level ${i + 1}`).toBe('solved');
      if (res.status === 'solved') expect(res.par, `level ${i + 1}`).toBe(def.par);
    }
  });
});
