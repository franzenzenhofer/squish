/* "Shared with you" — levels opened from a share link get their own picker
   section (between Your Levels and the campaign), playable, editable, deletable,
   and never self-spammed. Seeds the shelf directly for a deterministic UI test. */
import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __squishy?: import('../../src/game/testapi').SquishyTestApi;
  }
}

const seedShared = (page: import('@playwright/test').Page): Promise<void> =>
  page.evaluate(() => {
    localStorage.clear();
    const item = {
      id: 's1', name: 'Shared level', code: 'CODE-X', createdAt: 1,
      def: { w: 3, h: 3, target: [2, 0], dots: [[0, 0]], par: 1 }
    };
    localStorage.setItem('squish-shared:s1', JSON.stringify(item));
    localStorage.setItem('squish-shared-list', JSON.stringify(['s1']));
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__squishy !== undefined);
});

test('the picker shows a "Shared with you" shelf and the campaign heading', async ({ page }) => {
  await seedShared(page);
  await page.click('#blevels');
  await expect(page.locator('#levels')).toHaveClass(/show/);
  await expect(page.locator('[data-shelf="shared"]')).toHaveCount(1);
  await expect(page.locator('[data-shelf="shared"] .lvsec')).toHaveText('SHARED WITH YOU');
  await expect(page.locator('#levels')).toContainText('SQUISHY & FRIENDS ADVENTURES');
  await expect(page.locator('[data-testid="shared-play"]')).toBeVisible();
  await expect(page.locator('[data-testid="shared-edit"]')).toBeVisible();
  await expect(page.locator('[data-testid="shared-delete"]')).toBeVisible();
});

test('a shared level plays on tap (not the start screen)', async ({ page }) => {
  await seedShared(page);
  await page.evaluate(() => window.__squishy?.setInstantAnims(true));
  await page.click('#blevels');
  await page.click('[data-testid="shared-play"]');
  await page.waitForFunction(() => window.__squishy?.state().mode === 'idle', undefined, { timeout: 10000 });
  await expect(page.locator('#start')).not.toHaveClass(/show/);
  await expect(page.locator('#levels')).not.toHaveClass(/show/);
});

test('a shared level is deletable', async ({ page }) => {
  await seedShared(page);
  await page.click('#blevels');
  await page.click('[data-testid="shared-delete"]');
  await expect(page.locator('[data-shelf="shared"]')).toHaveCount(0);
});
