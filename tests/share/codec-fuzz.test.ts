/* Property test: random valid one-element-per-cell defs round-trip losslessly.
   Specifically exercises directional tokens (oneway/breeze) and portal pairs,
   which the curated set may not cover. Deterministic PRNG (no Math.random). */
import { describe, expect, it } from 'vitest';
import type { LevelDef, XY, DirCode } from '../../src/engine/types';
import { encode, decode, geometryEqual } from '../../src/share/codec';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS: DirCode[] = ['U', 'D', 'L', 'R'];

function randomDef(rnd: () => number): LevelDef {
  const w = 3 + Math.floor(rnd() * 5);
  const h = 3 + Math.floor(rnd() * 5);
  const cells: XY[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
  // shuffle
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  let k = 0;
  const take = (): XY => cells[k++];
  const def: LevelDef = { w, h, target: take(), dots: [take()], par: 0 };
  const nDots = Math.floor(rnd() * 2);
  for (let i = 0; i < nDots && k < cells.length; i++) def.dots.push(take());
  const simple: (keyof LevelDef)[] = ['walls', 'ice', 'spring', 'stars', 'boxes', 'bears', 'frogs'];
  for (const f of simple) {
    if (k >= cells.length || rnd() < 0.4) continue;
    const n = 1 + Math.floor(rnd() * 2);
    const arr: XY[] = [];
    for (let i = 0; i < n && k < cells.length; i++) arr.push(take());
    (def as Record<string, unknown>)[f] = arr;
  }
  if (rnd() < 0.5 && k < cells.length) {
    def.oneway = [[...take(), DIRS[Math.floor(rnd() * 4)]] as [number, number, DirCode]];
  }
  if (rnd() < 0.5 && k < cells.length) {
    def.breeze = [[...take(), DIRS[Math.floor(rnd() * 4)]] as [number, number, DirCode]];
  }
  if (rnd() < 0.5 && k + 1 < cells.length) {
    def.portals = [take(), take()];
  }
  return def;
}

describe('codec fuzz', () => {
  it('round-trips 500 random valid defs', () => {
    const rnd = mulberry32(1337);
    for (let i = 0; i < 500; i++) {
      const def = randomDef(rnd);
      const back = decode(encode(def));
      expect(geometryEqual(back, def)).toBe(true);
    }
  });
  it('preserves portal A/B order', () => {
    const def: LevelDef = { w: 3, h: 3, target: [0, 0], dots: [[2, 2]], portals: [[1, 0], [0, 1]], par: 0 };
    const back = decode(encode(def));
    expect(back.portals).toEqual([[1, 0], [0, 1]]);
  });
});
