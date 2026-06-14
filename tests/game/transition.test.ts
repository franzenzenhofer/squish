import { afterEach, describe, expect, it, vi } from 'vitest';
import { fadeSwap } from '../../src/game/transition';

function stubFadeElement(): { contains: (name: string) => boolean } {
  const classes = new Set<string>();
  const el = {
    classList: {
      add: (name: string): void => { classes.add(name); },
      remove: (name: string): void => { classes.delete(name); },
      contains: (name: string): boolean => classes.has(name)
    }
  };
  vi.stubGlobal('document', {
    getElementById: (id: string): typeof el | null => id === 'fade' ? el : null
  });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    cb(0);
    return 1;
  });
  return { contains: (name) => classes.has(name) };
}

describe('fadeSwap', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('removes the fade veil even when the async apply step rejects', async () => {
    vi.useFakeTimers();
    const fade = stubFadeElement();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    fadeSwap(false, async () => {
      throw new Error('worker failed');
    });

    expect(fade.contains('show')).toBe(true);
    await vi.advanceTimersByTimeAsync(240);
    await Promise.resolve();
    expect(fade.contains('show')).toBe(false);
  });
});
