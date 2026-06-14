/* Issue #6 — the daily-rotating anonymous token: stable within a day, rotated at
   the day boundary (no cross-day identity), clean charset, and the schema accepts
   it as the only sanitized free string. */
import { describe, expect, it } from 'vitest';
import { dailyToken } from '../../src/game/persist';
import { sanitizeEvent } from '../../src/lib/trackSchema';

function fakeStore(): { getItem(k: string): string | null; setItem(k: string, v: string): void } {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe('daily-rotating token (issue #6)', () => {
  it('is stable within a day and rotates across the day boundary', () => {
    const s = fakeStore();
    const a1 = dailyToken('2026-06-14', Math.random, s);
    const a2 = dailyToken('2026-06-14', Math.random, s); // same day -> reused
    expect(a2).toBe(a1);
    const b = dailyToken('2026-06-15', Math.random, s);  // new day -> rotated
    expect(b).not.toBe(a1);
    expect(dailyToken('2026-06-15', Math.random, s)).toBe(b); // stable again
  });
  it('is a short lowercase-alphanumeric value (no PII surface)', () => {
    expect(dailyToken('2026-06-14', Math.random, fakeStore())).toMatch(/^[a-z0-9]{1,16}$/);
  });
});

describe('track schema token sanitization', () => {
  it('accepts a clean token and strips anything else', () => {
    expect(sanitizeEvent({ e: 'win', t: 'ABc123' })?.t).toBe('abc123');
    expect(sanitizeEvent({ e: 'win', t: 'a b!@#c-' })?.t).toBe('abc');
    expect(sanitizeEvent({ e: 'win', t: 'x'.repeat(50) })?.t?.length).toBe(16);
    expect(sanitizeEvent({ e: 'win', t: '!!!' })?.t).toBeUndefined();
    expect(sanitizeEvent({ e: 'win' })?.t).toBeUndefined();
  });
});
