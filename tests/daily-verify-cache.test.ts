/* Daily verification cache: expensive 366-day proofs are reused only when the
   engine/generator fingerprint matches. Corrupt or stale cache files must fall
   back to an empty cache, never crash or trust old proof. */
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  emptyDailyVerifyCache,
  hashDailyDef,
  loadDailyVerifyCache,
  saveDailyVerifyCache,
  type DailyVerifyEntry
} from '../scripts/dailyVerifyCache';

function tempFile(): string {
  return join(mkdtempSync(join(tmpdir(), 'squish-daily-cache-')), 'cache.json');
}

const entry: DailyVerifyEntry = {
  date: '2026-06-14',
  par: 8,
  states: 1234,
  width: 6,
  height: 6,
  solution: 'ULDR',
  defHash: 'abc123',
  verifiedAt: '2026-06-14T00:00:00.000Z'
};

describe('daily verify cache', () => {
  it('round-trips entries for the same fingerprint', () => {
    const file = tempFile();
    const cache = emptyDailyVerifyCache('fp-a');
    cache.days[entry.date] = entry;
    saveDailyVerifyCache(file, cache);

    expect(loadDailyVerifyCache(file, 'fp-a').days[entry.date]).toEqual(entry);
  });

  it('invalidates stale, missing, and corrupt cache files', () => {
    const stale = tempFile();
    saveDailyVerifyCache(stale, { fp: 'old', days: { [entry.date]: entry } });
    expect(loadDailyVerifyCache(stale, 'new').days).toEqual({});

    expect(loadDailyVerifyCache(tempFile(), 'new').days).toEqual({});

    const corrupt = tempFile();
    writeFileSync(corrupt, '{ nope');
    expect(loadDailyVerifyCache(corrupt, 'new').days).toEqual({});
  });

  it('hashes daily definitions deterministically', () => {
    const a = { w: 3, h: 3, target: [0, 0], dots: [[2, 2]], par: 1 };
    const b = { w: 3, h: 3, target: [0, 0], dots: [[2, 2]], par: 1 };
    const expected = createHash('sha1').update(JSON.stringify(a)).digest('hex');
    expect(hashDailyDef(a)).toBe(expected);
    expect(hashDailyDef(b)).toBe(expected);
  });
});
