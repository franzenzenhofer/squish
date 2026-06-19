/* Guards the shipped levels manifest (src/levels-verified.json) - the pinned,
   pre-solved endless ladder (51..200) the client loads instantly instead of
   generating on-device (the slow path that caused the level-61 "stuck then
   crash").

   These levels are PINNED, HAND-EDITABLE DATA, treated exactly like the curated
   1..50 set - not a generator cache. So this guard checks SELF-CONSISTENCY, NOT
   equality with the live generator. That decoupling lets a single level be
   hand-edited and re-solved (`npm run level:resolve <n>`) without re-baking the
   whole ladder.

   Solvability is proven by REPLAYING each level's baked-in solution to a win -
   the committed `sol` string IS the cached result of the (expensive, one-time)
   solve, so a release replays it instantly instead of re-deriving it with BFS.
   The optimal par behind that solution is computed once, at edit time, by
   `resolveDef` / `npm run level:resolve`, never per release. */
import { describe, expect, it } from 'vitest';
import manifest from '../src/levels-verified.json';
import { CODEDIR, cloneState, isWin, makeLevel } from '../src/engine/core';
import { move } from '../src/engine/move';
import type { DirCode, LevelDef } from '../src/engine/types';

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

  it('every shipped level replays its baked solution to a win (cached: no re-solve)', () => {
    for (let n = FIRST; n <= LAST; n++) {
      const def = levels[String(n)] as LevelDef;
      const level = makeLevel(def);
      let st = cloneState(level.initState);
      for (const c of (def.sol ?? '').split('') as DirCode[]) {
        const r = move(level, st, CODEDIR[c]);
        expect(r.moved, 'L' + n + ' step ' + c + ' must move').toBe(true);
        st = r.state;
      }
      expect(isWin(level, st), 'L' + n + ' solution must end on the heart').toBe(true);
    }
  });
});
