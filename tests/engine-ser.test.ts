/* BFS keys must stay canonical regardless of piece/set insertion order, while
   the common empty/singleton cases stay allocation-light for solver/oracle
   throughput. */
import { describe, expect, it } from 'vitest';
import { cloneState, makeLevel, ser } from '../src/engine/core';
import type { LevelDef } from '../src/engine/types';

const def: LevelDef = {
  w: 4, h: 4, target: [0, 0], dots: [[3, 3], [1, 1]], walls: [[0, 1]], par: 1
};

describe('state serialization', () => {
  it('is canonical for reordered arrays and sets', () => {
    const level = makeLevel(def);
    const a = cloneState(level.initState);
    const b = cloneState(level.initState);

    b.dots = [...b.dots].reverse();
    a.boxes = [{ x: 3, y: 0 }, { x: 1, y: 0 }];
    b.boxes = [{ x: 1, y: 0 }, { x: 3, y: 0 }];
    a.broken = new Set(['3,3', '1,1']);
    b.broken = new Set(['1,1', '3,3']);
    a.stars = new Set(['2,2', '0,3']);
    b.stars = new Set(['0,3', '2,2']);

    expect(ser(a)).toBe(ser(b));
  });
});
