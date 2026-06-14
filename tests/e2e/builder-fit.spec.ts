/* The editor MUST fit one portrait screen at every phone size — no scrolling,
   header logo never clipped, no dead gap, board + palette + actions all visible.
   These guard the exact issues seen on a real iPhone. */
import { expect, test } from '@playwright/test';

const SIZES = [
  { w: 360, h: 640, name: 'small-android' },
  { w: 375, h: 667, name: 'iphone-se' },
  { w: 390, h: 844, name: 'iphone-14' },
  { w: 430, h: 932, name: 'iphone-pro-max' }
];

for (const s of SIZES) {
  test(`editor fits one screen on ${s.name} (${s.w}x${s.h})`, async ({ page }) => {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.goto('/?test=1');
    await page.waitForFunction(() => window.__squishBuilder !== undefined);
    await page.evaluate(() => {
      const x = window.__squishBuilder!;
      x.open(); x.resize(5, 5);
      x.selectTool('heart'); x.place(2, 2);
      x.selectTool('squishy'); x.place(3, 2);
    });
    await page.waitForTimeout(400);

    const m = await page.evaluate(() => {
      const r = (id: string): DOMRect => document.getElementById(id)!.getBoundingClientRect();
      const head = r('bLogo');
      const chips = document.querySelector('.bsizes')!.getBoundingClientRect();
      return {
        vh: window.innerHeight,
        docScroll: document.documentElement.scrollHeight,
        logoW: head.width, logoRight: head.right, headRight: r('bExit').right,
        gapHeadToChips: chips.top - r('bStatus').bottom,
        boardBottom: r('bBoardWrap').bottom,
        paletteBottom: r('bPalette').bottom,
        actionsBottom: r('bActions').bottom,
        playVisible: r('bPlay').width > 0 && r('bPlay').bottom <= window.innerHeight
      };
    });

    // 1. nothing scrolls off the screen
    expect(m.docScroll, 'no vertical scroll').toBeLessThanOrEqual(s.h + 1);
    // 2. header logo is actually rendered (not collapsed/clipped to nothing)
    expect(m.logoW, 'logo has width').toBeGreaterThan(40);
    // 3. no dead gap between the header and the size chips
    expect(m.gapHeadToChips, 'no huge gap under header').toBeLessThan(24);
    // 4/5/6. board, palette and the action bar are all fully on screen
    expect(m.boardBottom).toBeLessThanOrEqual(s.h);
    expect(m.paletteBottom, 'palette fully visible').toBeLessThanOrEqual(s.h);
    expect(m.actionsBottom, 'Play/Save/Share on screen').toBeLessThanOrEqual(s.h);
    expect(m.playVisible, 'Play button visible').toBe(true);
  });
}
