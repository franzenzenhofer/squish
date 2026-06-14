/* Structural validation: the speech-bubble hints and the solve-gate. */
import { describe, expect, it } from 'vitest';
import { createBuilderState, selectTool, placeAt } from '../../src/builder/state';
import { structuralErrors, canSolveCheck } from '../../src/builder/validate';

describe('structuralErrors', () => {
  it('asks for a heart when none placed', () => {
    const s = createBuilderState(5, 5);
    selectTool(s, 'squishy'); placeAt(s, 0, 0);
    expect(structuralErrors(s).join(' ')).toMatch(/heart/i);
    expect(canSolveCheck(s)).toBe(false);
  });
  it('asks for a squishy when none placed', () => {
    const s = createBuilderState(5, 5);
    selectTool(s, 'heart'); placeAt(s, 0, 0);
    expect(structuralErrors(s).join(' ')).toMatch(/squishy/i);
    expect(canSolveCheck(s)).toBe(false);
  });
  it('is clear and gate-open when heart + squishy present', () => {
    const s = createBuilderState(5, 5);
    selectTool(s, 'heart'); placeAt(s, 0, 0);
    selectTool(s, 'squishy'); placeAt(s, 4, 4);
    expect(structuralErrors(s)).toEqual([]);
    expect(canSolveCheck(s)).toBe(true);
  });
});
