/* QR matrix: deterministic square boolean grid; bigger payload never shrinks
   the grid. The pure matrix is what we assert (canvas drawing is a thin wrap). */
import { describe, expect, it } from 'vitest';
import { qrMatrix } from '../../src/share/qr';

describe('qrMatrix', () => {
  it('returns a non-empty square boolean matrix', () => {
    const m = qrMatrix('https://squishy.franzai.com/#level-1-3x3-M00000002.abc');
    expect(m.length).toBeGreaterThan(0);
    const row = m[0];
    if (!row) throw new Error('empty matrix');
    expect(m.length).toBe(row.length);
    expect(typeof row[0]).toBe('boolean');
  });
  it('is deterministic for the same input', () => {
    const a = qrMatrix('squishy');
    const b = qrMatrix('squishy');
    expect(a).toEqual(b);
  });
  it('does not shrink for a longer url', () => {
    const small = qrMatrix('https://squishy.franzai.com/#level-1-3x3-M0000000D.aa').length;
    const big = qrMatrix('https://squishy.franzai.com/#level-1-7x7-' + 'W'.repeat(49) + '.bbbbbb').length;
    expect(big).toBeGreaterThanOrEqual(small);
  });
});
