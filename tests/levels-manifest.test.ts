/* Guards the shipped levels manifest (src/levels-verified.json) - the pinned,
   pre-solved endless ladder (51..200) the client loads instantly instead of
   generating on-device (the slow path that caused the level-61 "stuck then
   crash").

   These levels are PINNED, HAND-EDITABLE DATA, treated exactly like the curated
   1..50 set - not a generator cache. So this guard checks SELF-CONSISTENCY (every
   shipped board really solves to its stated par), NOT equality with the live
   generator. That decoupling is deliberate: it lets a single level be hand-edited
   and re-solved (`npm run level:resolve <n>`) without re-baking the whole ladder.
   The generator still SEEDS this file once (`npm run levels:manifest`) and still
   powers truly-endless play past 200, but the shipped 51..200 are data. */
import { describe, expect, it } from 'vitest';
import manifest from '../src/levels-verified.json';
import { makeLevel } from '../src/engine/core';
import { solve } from '../src/engine/solve';
import type { LevelDef } from '../src/engine/types';

const levels = manifest.levels as unknown as Record<string, LevelDef>;
const FIRST = 51;
const LAST = 200;

describe('shipped levels manifest', () => {
  it('covers every endless level 51..200 with a pre-solved board', () => {
    for (let n = FIRST; n <= LAST; n++) {
      const def = levels[String(n)];
      expect(def, 'missing level ' + n).toBeDefined();
      const d = def as LevelDef;
      expect(d.par, 'par too low for ' + n).toBeGreaterThanOrEqual(7);
      expect(d.sol?.length, 'sol/par mismatch for ' + n).toBe(d.par);
    }
    expect(Object.keys(levels).length).toBe(LAST - FIRST + 1);
  });

  it('every shipped level really solves to its stated par', () => {
    for (let n = FIRST; n <= LAST; n++) {
      const def = levels[String(n)] as LevelDef;
      const res = solve(makeLevel(def), { maxStates: 400000, maxDepth: def.par + 4 });
      expect(res.status, 'unsolved level ' + n).toBe('solved');
      if (res.status === 'solved') expect(res.par, 'par drift for ' + n).toBe(def.par);
    }
  }, 120000);
});
