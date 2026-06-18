/* The "After a win" setting must read clearly: three short options (Wait / Auto /
   Next) and a one-line explanation that updates to say exactly what the SELECTED
   option does — matching the real win-flow behaviour in endings.ts. */
import { expect, test } from '@playwright/test';

async function openSettings(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__squishy !== undefined);
  await page.evaluate(() => { localStorage.clear(); window.__squishy?.closeMenu(); });
  await page.evaluate(() => document.getElementById('bsettings')?.click());
  await page.waitForSelector('#settings.show', { timeout: 5000 });
}

test('after-win options are Wait / Auto / Next, each with a clear matching explanation', async ({ page }) => {
  await openSettings(page);

  const labels = await page.locator('#segAfterWin button').allTextContents();
  expect(labels).toEqual(['Wait', 'Auto', 'Next']);

  const expl = page.locator('#afterWinExpl');

  /* default is 'auto' — the card shows then advances on its own */
  await expect(expl).toHaveText(/auto-advances/i);

  /* 'Next' (value 'instant') — skip the card, straight to the next level */
  await page.locator('#segAfterWin button[data-v="instant"]').click();
  await expect(page.locator('#segAfterWin button[data-v="instant"]')).toHaveClass(/on/);
  await expect(expl).toHaveText(/next level/i);

  /* 'Wait' — the card waits for a tap */
  await page.locator('#segAfterWin button[data-v="wait"]').click();
  await expect(expl).toHaveText(/waits for your tap/i);
});

test('the anonymous-counts opt-out stays hidden on the web build (web is always-on)', async ({ page }) => {
  /* the toggle is surfaced ONLY in the iOS build; a `hidden` row must not leak
     onto web just because .setrow sets display:flex (author rule beats UA hidden) */
  await openSettings(page);
  await expect(page.locator('#setrowAnalytics')).toBeHidden();
});
