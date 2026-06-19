/* Guards the shipped levels manifest (src/levels-verified.json) - the prebaked
   endless ladder (51..200) the client loads instantly instead of generating
   on-device (the slow path that caused the level-61 "stuck then crash"). If the
   manifest falls out of lock-step with the generator, manifest users would see
   a different board than the live fallback. The fingerprint check fails the
   gates the moment engine/gen/levels change without `npm run levels:manifest`. */
import { describe, expect, it } from 'vitest';
import manifest from '../src/levels-verified.json';
import { makeLevel } from '../src/engine/core';
import { solve } from '../src/engine/solve';
import { generateLevel } from '../src/gen/generate';
import { dailyVerifyFingerprint } from '../scripts/dailyVerifyCache';
import type { LevelDef } from '../src/engine/types';

const levels = manifest.levels as unknown as Record<string, LevelDef>;
const FIRST = 51;
const LAST = 200;

describe('shipped levels manifest', () => {
  it('fingerprint matches the current engine/generator/levels', () => {
    expect(manifest.fp).toBe(dailyVerifyFingerprint());
  });

  it('covers every endless level 51..200 with a proven, pre-solved board', () => {
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

  /* The fp check guarantees lock-step with the generator. This proves the
     stored CONTENT equals generateLevel for an on-rung level the generator
     bakes quickly (pathological rungs use the safeBake descent and are not
     equal to a raw generateLevel call - that is the whole point). */
  it('an on-rung entry equals what generateLevel produces (spot check)', () => {
    expect(levels['51']).toEqual(generateLevel(51));
  }, 60000);
});
