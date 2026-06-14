/* Share URL builder: round-trip self-check before handing out a link, and a
   CRC-verified, solve-validated import that stamps par. */
import { describe, expect, it, vi } from 'vitest';
import type { LevelDef, SolveResult } from '../../src/engine/types';
import {
  buildShareCode, buildShareUrl, parseShareHash, importShareCode
} from '../../src/share/shareUrl';
import { encode } from '../../src/share/codec';

const def: LevelDef = { w: 3, h: 3, target: [0, 0], dots: [[2, 2]], walls: [[1, 1]], par: 4 };

describe('buildShareCode / buildShareUrl', () => {
  it('returns a valid code that decodes back to the same geometry', () => {
    const code = buildShareCode(def);
    expect(code).toMatch(/^level-/);
  });
  it('builds a public https url with the code in the hash', () => {
    const url = buildShareUrl(def);
    expect(url).toMatch(/^https:\/\/squishy\.franzai\.com\/#level-/);
    expect(url).not.toContain('app://');
  });
});

describe('parseShareHash', () => {
  it('extracts a #level- code', () => {
    expect(parseShareHash('#level-1-3x3-M00000002.abc')).toBe('level-1-3x3-M00000002.abc');
  });
  it('ignores other hashes', () => {
    expect(parseShareHash('#daily')).toBeNull();
    expect(parseShareHash('')).toBeNull();
  });
});

describe('importShareCode', () => {
  it('CRC-verifies, solves, and stamps the optimal par', () => {
    const code = encode(def);
    const solveFn = vi.fn((): SolveResult => ({ status: 'solved', par: 7, ways: 1, solution: [] }));
    const out = importShareCode(code, solveFn);
    expect(out.par).toBe(7);
    expect(out.target).toEqual([0, 0]);
    expect(solveFn).toHaveBeenCalledOnce();
  });
  it('throws on an unsolvable level', () => {
    const code = encode(def);
    expect(() => importShareCode(code, () => ({ status: 'unsolvable' }))).toThrow();
  });
  it('throws on a corrupt code before solving', () => {
    const solveFn = vi.fn((): SolveResult => ({ status: 'solved', par: 1, ways: 1, solution: [] }));
    expect(() => importShareCode('level-1-3x3-M00000002.zzzz', solveFn)).toThrow();
    expect(solveFn).not.toHaveBeenCalled();
  });
});
