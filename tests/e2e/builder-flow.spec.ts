/* E2e: the mobile builder fixes — driven through window.__squishBuilder /
   window.__squishy and asserted on real DOM. Covers the fresh-board size, the
   header chip removal, the heart-tip-only-on-tap + no-spam bubble, the tip
   bubble sitting over the header, Play gating, and the win/back round-trip
   between a built level and the editor (button label + browser Back). */
import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __squishBuilder?: import('../../src/builder/view').BuilderApi;
    __squishy?: import('../../src/game/testapi').SquishyTestApi;
  }
}

/** Build a solvable 3x3 (heart top-right, squishy top-left -> one slide right). */
const buildSolvable = (page: import('@playwright/test').Page): Promise<void> =>
  page.evaluate(() => {
    const b = window.__squishBuilder!;
    b.resize(3, 3);
    b.selectTool('heart'); b.place(2, 0);
    b.selectTool('squishy'); b.place(0, 0);
  });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__squishBuilder !== undefined);
  await page.evaluate(() => window.__squishBuilder?.open());
  await expect(page.locator('[data-testid="builder"]')).toHaveClass(/show/);
});

test('a fresh editor opens at 4x4', async ({ page }) => {
  const st = await page.evaluate(() => window.__squishBuilder!.getState());
  expect(st.w).toBe(4);
  expect(st.h).toBe(4);
  await expect(page.locator('[data-testid="size-chip"][data-size="4"]')).toHaveAttribute('data-active', 'true');
});

test('the header has no dead BUILDER chip', async ({ page }) => {
  await expect(page.locator('.btag')).toHaveCount(0);
  await expect(page.locator('#bLogo')).toBeVisible();
  await expect(page.locator('[data-testid="builder-status"]')).toBeVisible();
});

test('the corner tip fires ONCE when a heart is placed off a corner, over the header', async ({ page }) => {
  // on open: no bubble
  await page.waitForTimeout(200);
  await expect(page.locator('#bBubble')).not.toHaveClass(/show/);

  // a heart placed in a CORNER must NOT trigger the tip
  await page.evaluate(() => { const b = window.__squishBuilder!; b.resize(5, 5); b.selectTool('heart'); b.place(0, 0); });
  await page.waitForTimeout(250);
  await expect(page.locator('#bBubble')).not.toHaveClass(/show/);

  // moving the heart OFF the corner triggers the tip once
  await page.evaluate(() => { const b = window.__squishBuilder!; b.selectTool('heart'); b.place(2, 2); });
  await expect(page.locator('#bBubble')).toHaveClass(/show/);
  await expect(page.locator('#bBubbleText')).toContainText('heart in a corner');

  // the bubble sits OVER THE HEADER (its top is above the board)
  const pos = await page.evaluate(() => ({
    bubble: document.getElementById('bBubble')!.getBoundingClientRect().top,
    board: document.getElementById('bBoardWrap')!.getBoundingClientRect().top
  }));
  expect(pos.bubble).toBeLessThan(pos.board);
});

test('the palette starts scrolled left so the heart is visible', async ({ page }) => {
  const left = await page.evaluate(() => document.getElementById('bPalette')!.scrollLeft);
  expect(left).toBe(0);
});

test('no "Lovely share it" spam bubble appears when a level becomes solvable', async ({ page }) => {
  await buildSolvable(page);
  await expect(page.locator('[data-testid="builder-status"]')).toHaveAttribute('data-status', 'solvable', { timeout: 10000 });
  // give any stray bubble time to appear, then assert it never says the old line
  await page.waitForTimeout(500);
  const text = await page.locator('#bBubbleText').textContent();
  expect(text ?? '').not.toContain('Lovely');
});

test('Play is locked until the level is solvable', async ({ page }) => {
  await expect(page.locator('[data-testid="action-play"]')).toHaveAttribute('data-locked', 'true');
  // heart only -> still locked
  await page.evaluate(() => { const b = window.__squishBuilder!; b.resize(3, 3); b.selectTool('heart'); b.place(2, 0); });
  await expect(page.locator('[data-testid="action-play"]')).toHaveAttribute('data-locked', 'true');
  // heart + squishy + solvable -> unlocked
  await page.evaluate(() => { const b = window.__squishBuilder!; b.selectTool('squishy'); b.place(0, 0); });
  await expect(page.locator('[data-testid="builder-status"]')).toHaveAttribute('data-status', 'solvable', { timeout: 10000 });
  await expect(page.locator('[data-testid="action-play"]')).toHaveAttribute('data-locked', 'false');
});

test('Play a built level -> win shows an "Editor" button that returns to the editor', async ({ page }) => {
  await buildSolvable(page);
  await expect(page.locator('[data-testid="builder-status"]')).toHaveAttribute('data-status', 'solvable', { timeout: 10000 });

  await page.evaluate(() => { window.__squishy?.setInstantAnims(true); window.__squishBuilder!.play(); });
  await page.waitForFunction(() => window.__squishy?.state().mode === 'idle');

  // solve it through the real game
  await page.evaluate(async () => {
    const g = window.__squishy!;
    const sol = g.solution() ?? [];
    for (const d of sol) await g.move(d as never);
  });
  await expect(page.locator('#win')).toHaveClass(/show/, { timeout: 10000 });
  await expect(page.locator('#winNext')).toHaveText('Editor');

  // the Editor button returns to the editor with the same board
  await page.click('#winNext');
  await expect(page.locator('[data-testid="builder"]')).toHaveClass(/show/);
  expect(await page.evaluate(() => window.__squishBuilder!.getState().target)).toEqual([2, 0]);
});

test('a "Back to editor" button is shown while playing a built level and returns to the editor', async ({ page }) => {
  await buildSolvable(page);
  await expect(page.locator('[data-testid="builder-status"]')).toHaveAttribute('data-status', 'solvable', { timeout: 10000 });
  await page.evaluate(() => window.__squishBuilder!.play());
  await page.waitForFunction(() => window.__squishy?.state().mode === 'idle');

  await expect(page.locator('#backToEditor')).toBeVisible();
  await page.click('#backToEditor');
  await expect(page.locator('[data-testid="builder"]')).toHaveClass(/show/);
  expect(await page.evaluate(() => window.__squishBuilder!.getState().target)).toEqual([2, 0]);
});

test('the browser Back button steps a built-level play back to the editor, then to the menu', async ({ page }) => {
  await buildSolvable(page);
  await expect(page.locator('[data-testid="builder-status"]')).toHaveAttribute('data-status', 'solvable', { timeout: 10000 });
  await page.evaluate(() => window.__squishBuilder!.play());
  await page.waitForFunction(() => window.__squishy?.state().mode === 'idle');

  // back -> editor (level intact)
  await page.goBack();
  await expect(page.locator('[data-testid="builder"]')).toHaveClass(/show/);
  expect(await page.evaluate(() => window.__squishBuilder!.getState().target)).toEqual([2, 0]);

  // back again -> editor closes (previous view)
  await page.goBack();
  await expect(page.locator('[data-testid="builder"]')).not.toHaveClass(/show/);
});

test('the palette is ONE flat scroll row - no page dots', async ({ page }) => {
  await expect(page.locator('[data-testid="palette-page"]')).toHaveCount(0);
  await expect(page.locator('.bpage')).toHaveCount(0);
  // all tools live in the single scroller and it overflows horizontally (scrollable)
  const tools = await page.locator('[data-testid="tool"]').count();
  expect(tools).toBeGreaterThan(12);
  const overflow = await page.evaluate(() => {
    const p = document.getElementById('bPalette')!;
    return p.scrollWidth > p.clientWidth + 4;
  });
  expect(overflow).toBe(true);
});

test('New resets the editor to a fresh 4x4 board', async ({ page }) => {
  await page.evaluate(() => {
    const b = window.__squishBuilder!;
    b.resize(6, 6); b.selectTool('heart'); b.place(2, 0); b.selectTool('squishy'); b.place(0, 0);
  });
  expect(await page.evaluate(() => window.__squishBuilder!.getState().target)).toEqual([2, 0]);
  await page.click('[data-testid="action-new"]');
  const st = await page.evaluate(() => window.__squishBuilder!.getState());
  expect(st.w).toBe(4);
  expect(st.target).toBeNull();
  expect(st.dots).toEqual([]);
  await expect(page.locator('[data-testid="action-play"]')).toHaveAttribute('data-locked', 'true');
});

test('there is no Save button (Play and Share auto-save)', async ({ page }) => {
  await expect(page.locator('[data-testid="action-save"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="action-new"]')).toBeVisible();
});

test('the editor Share button is text-only (no icon)', async ({ page }) => {
  await expect(page.locator('[data-testid="action-share"]')).toHaveText('Share');
  await expect(page.locator('[data-testid="action-share"] svg')).toHaveCount(0);
});

test('auto-save updates the SAME creation in place - no duplicates', async ({ page }) => {
  await buildSolvable(page);
  await expect(page.locator('[data-testid="builder-status"]')).toHaveAttribute('data-status', 'solvable', { timeout: 10000 });
  const id1 = await page.evaluate(() => window.__squishBuilder!.save().id);
  const id2 = await page.evaluate(() => window.__squishBuilder!.save().id);
  await page.evaluate(() => window.__squishBuilder!.share()); // also persists
  const list = await page.evaluate(() => window.__squishBuilder!.listCreations());
  expect(id1).toBe(id2);
  expect(list.length).toBe(1);
});

test('the "Back to editor" button is hidden in a normal campaign level', async ({ page }) => {
  await page.evaluate(() => window.__squishBuilder!.close());
  await page.evaluate(() => window.__squishy?.loadLevel(0));
  await page.waitForFunction(() => window.__squishy?.state().mode === 'idle' || window.__squishy?.state().mode === 'menu');
  await expect(page.locator('#backToEditor')).toBeHidden();
});
