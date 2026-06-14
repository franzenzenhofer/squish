/* Guards the shipped daily manifest (src/daily-verified.json) against drift.
   The client loads dailies from this file to skip slow in-worker generation;
   if it ever falls out of lock-step with the generator, manifest users would
   see a different board than fallback users. The fingerprint check fails the
   gates the moment engine/gen/levels change without `npm run daily:manifest`. */
import { describe, expect, it } from 'vitest';
import manifest from '../src/daily-verified.json';
import { dailyVerifyFingerprint } from '../scripts/dailyVerifyCache';
import { generateDaily } from '../src/gen/daily';
import type { LevelDef } from '../src/engine/types';

const days = manifest.days as unknown as Record<string, LevelDef>;

describe('shipped daily manifest', () => {
  it('fingerprint matches the current engine/generator/levels', () => {
    expect(manifest.fp).toBe(dailyVerifyFingerprint());
  });

  it('covers the full daily year with in-band, pre-solved levels', () => {
    const dates = Object.keys(days);
    expect(dates.length).toBeGreaterThanOrEqual(365);
    for (const date of dates) {
      const def = days[date] as LevelDef;
      expect(def.par).toBeGreaterThanOrEqual(7);
      expect(def.par).toBeLessThanOrEqual(10);
      expect(def.sol?.length).toBe(def.par);
    }
  });

  /* The fp check above already guarantees the manifest is in lock-step with the
     generator. This proves the stored CONTENT really equals generateDaily for a
     couple of cheap-to-generate dates (the pathological ones cost 60-120s, which
     is exactly why they are precomputed and must not run in the test). */
  it('entries equal what generateDaily produces (spot check)', () => {
    for (const date of ['2026-06-20', '2026-11-11']) {
      expect(days[date]).toEqual(generateDaily(date));
    }
  }, 30000);
});
