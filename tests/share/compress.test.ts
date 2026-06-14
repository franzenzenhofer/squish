/* The compressed (zip) share payload round-trips losslessly and is shorter than
   the readable glyph code for typical sparse levels. */
import { describe, expect, it } from 'vitest';
import levels from '../../src/levels.json';
import type { LevelDef } from '../../src/engine/types';
import { encode, encodeBytes, decodeBytes, geometryEqual } from '../../src/share/codec';
import { compress, decompress } from '../../src/share/compress';
import { buildShareUrl, parseShareHash, importShareCode } from '../../src/share/shareUrl';

const defs = levels as unknown as LevelDef[];

describe('byte codec + compression', () => {
  it('byte-packs and round-trips every curated level', () => {
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      if (!d) throw new Error('missing ' + i);
      expect(geometryEqual(decodeBytes(encodeBytes(d)), d), 'level ' + i).toBe(true);
    }
  });
  it('compress/decompress round-trips the packed bytes', () => {
    const d = defs[3] as LevelDef;
    const bytes = encodeBytes(d);
    expect(Array.from(decompress(compress(bytes)))).toEqual(Array.from(bytes));
  });
  it('builds a compact #z- url that imports back to the same geometry', () => {
    const d = defs[5] as LevelDef;
    const url = buildShareUrl(d);
    expect(url).toMatch(/\/#z-/);
    const payload = parseShareHash('#' + url.split('#')[1]);
    expect(payload).not.toBeNull();
    const back = importShareCode(payload as string, () => ({ status: 'solved', par: 9, ways: 1, solution: [] }));
    expect(geometryEqual(back, d)).toBe(true);
    expect(back.par).toBe(9);
  });
  it('is shorter than the readable code for a sparse level', () => {
    const sparse: LevelDef = { w: 6, h: 6, target: [0, 0], dots: [[5, 5]], par: 1 };
    const z = buildShareUrl(sparse).split('#')[1] as string;
    const readable = encode(sparse);
    expect(z.length).toBeLessThan(readable.length);
  });
});
