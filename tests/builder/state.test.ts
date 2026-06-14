/* Builder state machine: placement, the one-element-per-cell invariant, unique
   heart, multi squishy, erase/drag-off, resize, and the toDef/fromDef contract. */
import { describe, expect, it } from 'vitest';
import {
  createBuilderState, selectTool, placeAt, eraseAt, resize, toDef, fromDef, dotCount
} from '../../src/builder/state';

describe('builder state machine', () => {
  it('starts empty at the requested size', () => {
    const s = createBuilderState(6, 6);
    expect(s.w).toBe(6);
    expect(s.h).toBe(6);
    expect(s.target).toBeNull();
    expect(dotCount(s)).toBe(0);
  });

  it('heart is unique and relocates when placed again', () => {
    const s = createBuilderState(5, 5);
    selectTool(s, 'heart');
    placeAt(s, 1, 1);
    expect(s.target).toEqual([1, 1]);
    placeAt(s, 3, 2);
    expect(s.target).toEqual([3, 2]); // moved, not duplicated
  });

  it('allows multiple squishies', () => {
    const s = createBuilderState(5, 5);
    selectTool(s, 'squishy');
    placeAt(s, 0, 0);
    placeAt(s, 4, 4);
    expect(dotCount(s)).toBe(2);
  });

  it('enforces at most one element per cell', () => {
    const s = createBuilderState(5, 5);
    selectTool(s, 'squishy');
    placeAt(s, 2, 2);
    selectTool(s, 'wall');
    placeAt(s, 2, 2); // wall replaces the squishy
    expect(dotCount(s)).toBe(0);
    expect(s.cells.get('2,2')).toBe('wall');
    selectTool(s, 'heart');
    placeAt(s, 2, 2); // heart replaces the wall
    expect(s.cells.has('2,2')).toBe(false);
    expect(s.target).toEqual([2, 2]);
  });

  it('erase and drag-off clear a cell', () => {
    const s = createBuilderState(5, 5);
    selectTool(s, 'wall');
    placeAt(s, 1, 1);
    eraseAt(s, 1, 1);
    expect(s.cells.has('1,1')).toBe(false);
  });

  it('resize drops out-of-bounds pieces', () => {
    const s = createBuilderState(6, 6);
    selectTool(s, 'heart');
    placeAt(s, 5, 5);
    selectTool(s, 'squishy');
    placeAt(s, 1, 1);
    resize(s, 4, 4);
    expect(s.target).toBeNull(); // (5,5) fell outside
    expect(dotCount(s)).toBe(1);
  });

  it('toDef / fromDef round-trips geometry', () => {
    const s = createBuilderState(5, 5);
    selectTool(s, 'heart'); placeAt(s, 0, 0);
    selectTool(s, 'squishy'); placeAt(s, 4, 4); placeAt(s, 3, 3);
    selectTool(s, 'wall'); placeAt(s, 2, 2);
    selectTool(s, 'star'); placeAt(s, 1, 1);
    const def = toDef(s);
    expect(def.target).toEqual([0, 0]);
    expect(def.dots).toHaveLength(2);
    expect(def.walls).toEqual([[2, 2]]);
    expect(def.stars).toEqual([[1, 1]]);
    const back = fromDef(def);
    expect(back.target).toEqual([0, 0]);
    expect(dotCount(back)).toBe(2);
    expect(back.cells.get('2,2')).toBe('wall');
    expect(back.cells.get('1,1')).toBe('star');
  });
});

import { countTool } from '../../src/builder/state';

describe('directional winds/arrows + capped portals', () => {
  it('encodes winds + arrows WITH direction and round-trips', () => {
    const s = createBuilderState(5, 5);
    selectTool(s, 'windR'); placeAt(s, 1, 1);
    selectTool(s, 'arrowU'); placeAt(s, 2, 2);
    const def = toDef(s);
    expect(def.breeze).toEqual([[1, 1, 'R']]);
    expect(def.oneway).toEqual([[2, 2, 'U']]);
    const s2 = fromDef(def);
    expect(s2.cells.get('1,1')).toBe('windR');
    expect(s2.cells.get('2,2')).toBe('arrowU');
  });
  it('caps portals at exactly two (a linked pair), refusing a third', () => {
    const s = createBuilderState(5, 5);
    selectTool(s, 'portal');
    placeAt(s, 0, 0); placeAt(s, 4, 4); placeAt(s, 2, 2); // 3rd refused by the cap
    expect(countTool(s, 'portal')).toBe(2);
    expect(toDef(s).portals).toEqual([[0, 0], [4, 4]]);
    expect(countTool(fromDef(toDef(s)), 'portal')).toBe(2);
  });
  it('omits portals until exactly two exist', () => {
    const s = createBuilderState(5, 5);
    selectTool(s, 'portal'); placeAt(s, 0, 0);
    expect(toDef(s).portals).toBeUndefined();
  });
});
