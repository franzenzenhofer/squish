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
    it(`level ${i} round-trips losslessly`, () => {
      const code = encode(defs[i]);
      const back = decode(code);
      expect(geometryEqual(back, defs[i])).toBe(true);
      expect(back.w).toBe(defs[i].w);
      expect(back.h).toBe(defs[i].h);
    });
  }
  it('emits the readable #level scheme shape', () => {
    const code = encode(defs[0]);
    expect(code).toMatch(/^level-\d+-\d+x\d+-[A-Za-z0-9]*\.[0-9a-z]+$/);
  });
});
