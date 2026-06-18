import { describe, expect, it } from 'vitest';
import { ensureCanvasSize } from '../../src/lib/canvas';

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    style: { width: '', height: '' }
  } as unknown as HTMLCanvasElement;
}

describe('ensureCanvasSize', () => {
  it('sets backing and css size once, then stays idempotent', () => {
    const c = fakeCanvas();
    ensureCanvasSize(c, 96, 48, 2, true);
    expect([c.width, c.height, c.style.width, c.style.height]).toEqual([192, 96, '96px', '48px']);

    ensureCanvasSize(c, 96, 48, 2, true);
    expect([c.width, c.height, c.style.width, c.style.height]).toEqual([192, 96, '96px', '48px']);
  });
});
