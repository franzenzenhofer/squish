/* The SSOT contract: a LevelDef built by the editor is accepted by the real
   engine (makeLevel) and judged by the real solver — solvable levels solve,
   walled-off ones are rejected. This is what the publish gate relies on. */
import { describe, expect, it } from 'vitest';
import { makeLevel } from '../../src/engine/core';
import { solve } from '../../src/engine/solve';
import { createBuilderState, selectTool, placeAt, toDef } from '../../src/builder/state';

describe('builder def -> engine', () => {
  it('makeLevel accepts editor output and solve finds a solution', () => {
    const s = createBuilderState(3, 3);
    selectTool(s, 'heart'); placeAt(s, 2, 0);
    selectTool(s, 'squishy'); placeAt(s, 0, 0);
    const res = solve(makeLevel(toDef(s)));
    expect(res.status).toBe('solved');
    if (res.status === 'solved') expect(res.par).toBeGreaterThan(0);
  });

  it('a walled-off heart is unsolvable', () => {
    const s = createBuilderState(3, 3);
    selectTool(s, 'heart'); placeAt(s, 1, 1);
    selectTool(s, 'wall');
    placeAt(s, 0, 1); placeAt(s, 2, 1); placeAt(s, 1, 0); placeAt(s, 1, 2);
    selectTool(s, 'squishy'); placeAt(s, 0, 0);
    const res = solve(makeLevel(toDef(s)));
    expect(res.status).toBe('unsolvable');
  });
});
