/* CRC32 integrity helper — known vectors + stability. */
import { describe, expect, it } from 'vitest';
import { crc32, crc32Base36 } from '../../src/share/crc32';

describe('crc32', () => {
  it('matches the canonical check vector', () => {
    expect(crc32('123456789') >>> 0).toBe(0xcbf43926);
  });
  it('is zero for the empty string', () => {
    expect(crc32('')).toBe(0);
  });
  it('differs for different input', () => {
    expect(crc32('squishy')).not.toBe(crc32('squishyy'));
    expect(crc32('ab')).not.toBe(crc32('ba'));
  });
  it('base36 form is stable and url-safe', () => {
    const a = crc32Base36('level-1-3x3-MD0000000');
    expect(a).toBe(crc32Base36('level-1-3x3-MD0000000'));
    expect(a).toMatch(/^[0-9a-z]+$/);
  });
});
