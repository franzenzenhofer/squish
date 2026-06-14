/* Glyph-table SSOT invariants: one unique glyph per geometry field, dir
   suffixes distinct from bases, reverse map round-trips. */
import { describe, expect, it } from 'vitest';
import { CELL_GLYPH, GLYPH_CELL, DIR_BASE, DIR_SUFFIX, EMPTY } from '../../src/share/glyphs';

describe('glyph table', () => {
  it('maps every cell field to a single unique glyph', () => {
    const glyphs = Object.values(CELL_GLYPH);
    expect(new Set(glyphs).size).toBe(glyphs.length);
    for (const g of glyphs) expect(g).toMatch(/^[A-Z0-9]$/);
  });
  it('reverse map round-trips every base glyph', () => {
    for (const [field, g] of Object.entries(CELL_GLYPH)) {
      expect(GLYPH_CELL[g]).toBe(field);
    }
  });
  it('directional bases are uppercase, suffixes lowercase and distinct', () => {
    for (const base of Object.values(DIR_BASE)) expect(base).toMatch(/^[A-Z]$/);
    const suffixes = Object.values(DIR_SUFFIX);
    expect(new Set(suffixes).size).toBe(suffixes.length);
    for (const s of suffixes) expect(s).toMatch(/^[a-z]$/);
  });
  it('empty is a distinct glyph not used by any field', () => {
    expect(EMPTY).toBe('0');
    expect(Object.values(CELL_GLYPH)).not.toContain(EMPTY);
  });
});
