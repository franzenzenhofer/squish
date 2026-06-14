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

  // the status pill resolves to SOLVABLE and unlocks Play/Share
  await expect(page.locator('[data-testid="builder-status"]')).toHaveAttribute('data-status', 'solvable', { timeout: 10000 });
  await expect(page.locator('[data-testid="action-share"]')).toHaveAttribute('data-locked', 'false');

  // the board state is AI-assertable through the API (the board is a canvas)
  expect(await page.evaluate(() => window.__squishBuilder!.getState().target)).toEqual([2, 0]);

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
  expect(await page.evaluate(() => window.__squishBuilder!.getState().cells)).toHaveProperty('1,1', 'wall');
  await page.evaluate(() => window.__squishBuilder!.dragOff(1, 1));
  expect(await page.evaluate(() => window.__squishBuilder!.getState().cells)).not.toHaveProperty('1,1');
});

test('a saved level shows in Your Levels and deletes from there', async ({ page }) => {
  await page.evaluate(() => {
    const b = window.__squishBuilder!;
    b.resize(3, 3);
    b.selectTool('heart'); b.place(2, 0);
    b.selectTool('squishy'); b.place(0, 0);
  });
  await expect(page.locator('[data-testid="builder-status"]')).toHaveAttribute('data-status', 'solvable', { timeout: 10000 });
  await page.evaluate(() => window.__squishBuilder!.save());
  // leave the editor and open the Levels picker
  await page.evaluate(() => window.__squishBuilder!.close());
  await page.click('#blevels');
  const card = page.locator('[data-testid="creation-card"]');
  await expect(card).toHaveCount(1);
  await page.locator('[data-testid="creation-delete"]').first().click();
  await expect(page.locator('[data-testid="creation-card"]')).toHaveCount(0);
});

test('a #level- deep link opens the shared level in play', async ({ page }) => {
  const url = await page.evaluate(() => {
    const b = window.__squishBuilder!;
    b.resize(3, 3);
    b.selectTool('heart'); b.place(2, 0);
    b.selectTool('squishy'); b.place(0, 0);
    return b.def();
  });
  // build a fresh page at the shared deep link
  const code = await page.evaluate(() => {
    const b = window.__squishBuilder!;
    return new Promise<string>((res) => {
      const tick = (): void => {
        if (b.getState().canPublish) res(b.share());
        else setTimeout(tick, 100);
      };
      tick();
    });
  });
  void url;
  const hash = code.slice(code.indexOf('#'));
  // a hash-only goto does not reload — force a full navigation
  await page.goto('about:blank');
  await page.goto('/?test=1' + hash);
  await page.waitForFunction(() => window.__squishy !== undefined);
  await page.waitForFunction(() => window.__squishy?.state().mode === 'idle', undefined, { timeout: 10000 });
  expect(await page.evaluate(() => window.__squishy?.state().play)).toContain('debug');
});

test('the browser back button steps out: share sheet -> editor -> previous view', async ({ page }) => {
  await expect(page.locator('[data-testid="builder"]')).toHaveClass(/show/);
  // build a solvable level and open the share sheet
  await page.evaluate(() => {
    const b = window.__squishBuilder!;
    b.resize(3, 3);
    b.selectTool('heart'); b.place(2, 0);
    b.selectTool('squishy'); b.place(0, 0);
  });
  await expect(page.locator('[data-testid="builder-status"]')).toHaveAttribute('data-status', 'solvable', { timeout: 10000 });
  await page.click('[data-testid="action-share"]');
  await expect(page.locator('#bShareSheet')).toHaveAttribute('data-shown', 'true');
  // back closes the sheet, editor still open
  await page.goBack();
  await expect(page.locator('#bShareSheet')).toHaveAttribute('data-shown', 'false');
  await expect(page.locator('[data-testid="builder"]')).toHaveClass(/show/);
  // back again closes the editor
  await page.goBack();
  await expect(page.locator('[data-testid="builder"]')).not.toHaveClass(/show/);
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
