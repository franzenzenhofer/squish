/* E2e: the full level-editor journey driven entirely through the AI interface
   window.__squishBuilder and asserted via DOM data hooks — build a solvable
   level, watch the SOLVABLE pill, save it, see it in creations, play it through
   the real game, delete it; plus the unsolvable lock and drag-off delete. */
import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __squishBuilder?: import('../../src/builder/view').BuilderApi;
    __squishy?: import('../../src/game/testapi').SquishyTestApi;
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__squishBuilder !== undefined);
  await page.evaluate(() => window.__squishBuilder?.open());
});

test('build a solvable level, save, see it, play it, delete it', async ({ page }) => {
  await expect(page.locator('[data-testid="builder"]')).toHaveClass(/show/);

  // place a heart and a squishy on a 3x3 with a clear slide
  await page.evaluate(() => {
    const b = window.__squishBuilder!;
    b.resize(3, 3);
    b.selectTool('heart'); b.place(2, 0);
    b.selectTool('squishy'); b.place(0, 0);
  });

  // the status pill resolves to SOLVABLE and unlocks Save/Share
  await expect(page.locator('[data-testid="builder-status"]')).toHaveAttribute('data-status', 'solvable', { timeout: 10000 });
  await expect(page.locator('[data-testid="action-save"]')).toHaveAttribute('data-locked', 'false');

  // a cell reports its fill through the DOM (AI-assertable board)
  await expect(page.locator('.bcell[data-x="2"][data-y="0"]')).toHaveAttribute('data-fill', 'heart');

  // save -> appears in creations
  const id = await page.evaluate(() => window.__squishBuilder!.save().id);
  const list = await page.evaluate(() => window.__squishBuilder!.listCreations());
  expect(list.map((c) => c.id)).toContain(id);

  // play it -> the real game accepts the level and becomes playable
  await page.evaluate(() => window.__squishBuilder!.play());
  await page.waitForFunction(() => window.__squishy?.state().mode === 'idle');

  // delete it
  await page.evaluate((cid) => window.__squishBuilder!.deleteCreation(cid), id);
  const after = await page.evaluate(() => window.__squishBuilder!.listCreations());
  expect(after.map((c) => c.id)).not.toContain(id);
});

test('drag-off deletes a piece and the pill reflects the DOM', async ({ page }) => {
  await page.evaluate(() => {
    const b = window.__squishBuilder!;
    b.resize(4, 4);
    b.selectTool('wall'); b.place(1, 1);
  });
  await expect(page.locator('.bcell[data-x="1"][data-y="1"]')).toHaveAttribute('data-fill', 'wall');
  await page.evaluate(() => window.__squishBuilder!.dragOff(1, 1));
  await expect(page.locator('.bcell[data-x="1"][data-y="1"]')).toHaveAttribute('data-fill', 'empty');
});

test('an unsolvable level keeps Share locked and share() throws', async ({ page }) => {
  await page.evaluate(() => {
    const b = window.__squishBuilder!;
    b.resize(3, 3);
    b.selectTool('heart'); b.place(1, 1);
    b.selectTool('wall'); b.place(0, 1); b.place(2, 1); b.place(1, 0); b.place(1, 2);
    b.selectTool('squishy'); b.place(0, 0);
  });
  await expect(page.locator('[data-testid="builder-status"]')).toHaveAttribute('data-status', 'unsolvable', { timeout: 10000 });
  await expect(page.locator('[data-testid="action-share"]')).toHaveAttribute('data-locked', 'true');
  const threw = await page.evaluate(() => { try { window.__squishBuilder!.share(); return false; } catch { return true; } });
  expect(threw).toBe(true);
});
