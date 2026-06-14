/* The core property: decode(encode(def)) is geometry-identical to def, proven
   across ALL 50 curated levels (real data). par/sol/cap are not encoded. */
import { describe, expect, it } from 'vitest';
import levels from '../../src/levels.json';
import type { LevelDef } from '../../src/engine/types';
import { encode, decode, geometryEqual } from '../../src/share/codec';

const defs = levels as unknown as LevelDef[];

describe('codec round-trip over curated levels', () => {
  it('has all 50 levels', () => {
    expect(defs.length).toBeGreaterThanOrEqual(50);
  });
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    it(`level ${i} round-trips losslessly`, () => {
      if (!d) throw new Error('missing level ' + i);
      const code = encode(d);
      const back = decode(code);
      expect(geometryEqual(back, d)).toBe(true);
      expect(back.w).toBe(d.w);
      expect(back.h).toBe(d.h);
    });
  }
  it('emits the readable #level scheme shape', () => {
    const first = defs[0];
    if (!first) throw new Error('no levels');
    const code = encode(first);
    expect(code).toMatch(/^level-\d+-\d+x\d+-[A-Za-z0-9]*\.[0-9a-z]+$/);
  });
});
