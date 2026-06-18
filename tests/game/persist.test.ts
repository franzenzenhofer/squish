import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadGame } from '../../src/game/persist';

function stubStorage(value: string | null): void {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => k === 'squish-progress-v2' ? value : null,
    setItem: () => undefined,
    removeItem: () => undefined,
    key: () => null,
    length: 0
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadGame', () => {
  it('falls back to level 0 for corrupted resume indices', () => {
    stubStorage(JSON.stringify({ v: 2, li: -1 }));
    expect(loadGame().li).toBe(0);

    stubStorage(JSON.stringify({ v: 2, li: 1.5 }));
    expect(loadGame().li).toBe(0);
  });
});
