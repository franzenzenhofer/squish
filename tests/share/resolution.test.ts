/* Resolution guard: locks in the high-res share fix so it cannot silently
   regress. The board/card are supersampled by SHARE_DPR and the GIF output is
   nearly doubled. Pixel-level rendering is exercised by the Playwright e2e in a
   real browser; here we assert the constants that drive the fix. */
import { describe, expect, it } from 'vitest';
import { SHARE_DPR, CARD_W, CARD_H } from '../../src/game/share';
import { GIF_W, GIF_H } from '../../src/game/shareGif';

describe('share resolution constants', () => {
  it('supersamples the card/board by at least 2x', () => {
    expect(SHARE_DPR).toBeGreaterThanOrEqual(2);
  });
  it('emits a GIF near double the old 416x507', () => {
    expect(GIF_W).toBeGreaterThanOrEqual(760);
    expect(GIF_H).toBeGreaterThanOrEqual(920);
  });
  it('keeps the card aspect ratio for the GIF', () => {
    const cardAspect = CARD_W / CARD_H;
    const gifAspect = GIF_W / GIF_H;
    expect(Math.abs(cardAspect - gifAspect)).toBeLessThan(0.02);
  });
});
