/* Regression: the editor board must never vanish. When there is no heart yet
   (fresh board, or while the heart is lifted for a re-drag), builderSession must
   still carry every other piece and only park the heart OFF-BOARD, so the one
   gameplay renderer keeps painting the panel, tiles and pieces. */
import { describe, expect, it } from 'vitest';
import { builderSession } from '../../src/builder/render';
import { createBuilderState, selectTool, placeAt } from '../../src/builder/state';

describe('builderSession (no-vanish contract)', () => {
  it('keeps the pieces and parks the heart off-board when no heart is placed', () => {
    const st = createBuilderState(5, 5);
    selectTool(st, 'squishy'); placeAt(st, 0, 0); placeAt(st, 4, 4);
    selectTool(st, 'wall'); placeAt(st, 2, 2);
    const s = builderSession(st);
    // heart parked off the board (not drawn) ...
    expect(s.level.tx < 0 || s.level.ty < 0).toBe(true);
    // ... but every other piece is still in the render session
    expect(s.gs.dots.length).toBe(2);
    expect(s.level.walls.has('2,2')).toBe(true);
  });

  it('puts the heart on its real cell once placed', () => {
    const st = createBuilderState(5, 5);
    selectTool(st, 'heart'); placeAt(st, 1, 3);
    selectTool(st, 'squishy'); placeAt(st, 0, 0);
    const s = builderSession(st);
    expect([s.level.tx, s.level.ty]).toEqual([1, 3]);
  });
});
