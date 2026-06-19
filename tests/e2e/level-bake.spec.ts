/* The level-61 regression + the bulletproof-bake guarantee, in a real browser
   with the real workers.

   Before: advancing to level 61 ran on-device generation that churned for
   MINUTES (the oracle could not exhaust the cast's state graph), so the worker
   never posted a level - "Baking level 61..." forever, then the tab crashed.

   After: levels 51..200 are prebaked (instant from the shipped manifest) and a
   live bake (201+) is capped - if the worker has not answered in 10s the player
   gets a proven same-difficulty board. No load may ever hang. These tests fail
   if any of that regresses. */
import { expect, test } from '@playwright/test';

async function boot(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?test=1&debug=doit');
  await page.waitForFunction(() => window.__squishy !== undefined);
  await page.evaluate(() => {
    window.__squishy?.setInstantAnims(true);
    window.__squishy?.closeMenu();
    localStorage.clear();
  });
}

/** Load 0-based level index `li` and assert it SETTLES (leaves 'loading') within
    `budgetMs`. Returns the settle time so callers can assert "instant". */
async function loadWithin(
  page: import('@playwright/test').Page, li: number, budgetMs: number
): Promise<number> {
  const t0 = Date.now();
  await page.evaluate((n) => window.__squishy?.loadLevel(n), li);
  await page.waitForFunction(
    (n) => {
      const m = window.__squishy?.state();
      return m !== undefined && m.li === n && m.mode !== 'loading';
    },
    li, { timeout: budgetMs }
  );
  return Date.now() - t0;
}

test('level 61 loads instantly from the prebaked manifest (no stuck bake)', async ({ page }) => {
  await boot(page);
  /* level 61 is 0-based index 60. The old bug hung here for minutes; the
     prebaked manifest must resolve it well inside a few seconds. */
  const ms = await loadWithin(page, 60, 8000);
  expect(ms, 'level 61 must load fast from the manifest').toBeLessThan(8000);
  const st = await page.evaluate(() => window.__squishy?.state());
  expect(st?.li).toBe(60);
  expect(st?.mode === 'idle' || st?.mode === 'intro').toBe(true);
});

test('the whole prebaked ladder (51..200) loads fast on-device', async ({ page }) => {
  await boot(page);
  for (const li of [50, 99, 149, 199]) { // levels 51, 100, 150, 200
    const ms = await loadWithin(page, li, 8000);
    expect(ms, 'level ' + (li + 1) + ' must load fast from the manifest').toBeLessThan(8000);
  }
});

test('a beyond-manifest level (201) never makes the player wait past the guarantee', async ({ page }) => {
  await boot(page);
  /* level 201 (index 200) is past the prebaked range: it bakes live. The 10s
     watchdog must hand back a proven board - the player must NEVER be stuck. */
  const ms = await loadWithin(page, 200, 14000);
  expect(ms, 'a live bake must settle within the 10s guarantee (+ oracle)').toBeLessThan(14000);
  const st = await page.evaluate(() => window.__squishy?.state());
  expect(st?.li).toBe(200);
  expect(st?.mode === 'idle' || st?.mode === 'intro').toBe(true);
});
