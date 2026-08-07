/* Browser back/forward must navigate WITHIN the app, never an accidental exit.
   The start-screen overlays (Settings, Levels, Privacy) and a played level all
   push history so the hardware Back button returns to the start menu, and Forward
   re-opens what you left. The builder keeps its own (already-working) history. */
import { expect, test } from '@playwright/test';

type Page = import('@playwright/test').Page;

/* These tests are the RETURNING player's contract: the start menu greets anyone
   with progress to continue, and Back must walk its overlays, never leave the
   app. A first-time visitor deliberately boots onto the board instead (see
   flow.bootPlan) — that contract is proven by its own test at the bottom. */
async function boot(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('squish-progress-v2', JSON.stringify({
      v: 2, play: { kind: 'campaign' }, li: 1, def: null,
      results: { 0: 3 }, hinted: {}, daily: {}
    }));
  });
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__squishy !== undefined);
  await page.evaluate(() => window.__squishy?.setInstantAnims(true));
  await page.waitForSelector('#start.show', { timeout: 8000 });
}

test('Back from Settings returns to the start menu, not out of the app', async ({ page }) => {
  await boot(page);
  await page.click('#bsettings');
  await expect(page.locator('#settings')).toHaveClass(/show/);
  await page.goBack();
  await expect(page.locator('#settings')).not.toHaveClass(/show/);
  await expect(page.locator('#start')).toHaveClass(/show/);
  expect(await page.evaluate(() => window.__squishy !== undefined), 'still in the app').toBe(true);
});

test('Forward re-opens Settings (state-driven render)', async ({ page }) => {
  await boot(page);
  await page.click('#bsettings');
  await page.goBack();
  await expect(page.locator('#settings')).not.toHaveClass(/show/);
  await page.goForward();
  await expect(page.locator('#settings')).toHaveClass(/show/);
});

test('Back from Levels returns to the start menu', async ({ page }) => {
  await boot(page);
  await page.click('#blevels');
  await expect(page.locator('#levels')).toHaveClass(/show/);
  await page.goBack();
  await expect(page.locator('#levels')).not.toHaveClass(/show/);
  await expect(page.locator('#start')).toHaveClass(/show/);
});

test('Privacy nests over Settings: Back chains privacy -> settings -> menu', async ({ page }) => {
  await boot(page);
  await page.click('#bsettings');
  await page.click('#bprivacy');
  await expect(page.locator('#privacy')).toHaveClass(/show/);
  await expect(page.locator('#settings')).toHaveClass(/show/);
  await page.goBack();
  await expect(page.locator('#privacy')).not.toHaveClass(/show/);
  await expect(page.locator('#settings')).toHaveClass(/show/);
  await page.goBack();
  await expect(page.locator('#settings')).not.toHaveClass(/show/);
  await expect(page.locator('#start')).toHaveClass(/show/);
});

test('Back from a played level returns to the start menu (no accidental out)', async ({ page }) => {
  await boot(page);
  await page.click('#bplay');
  await page.waitForFunction(() => window.__squishy?.state().mode !== 'menu');
  await expect(page.locator('#start')).not.toHaveClass(/show/);
  await page.goBack();
  await expect(page.locator('#start')).toHaveClass(/show/);
});

test('advancing levels does not stack history: one Back from a later level returns to the menu', async ({ page }) => {
  await boot(page);
  await page.click('#bplay');
  await page.evaluate(() => window.__squishy?.solve());
  await page.waitForSelector('#win.show', { timeout: 10000 });
  await page.click('#winNext');
  await page.waitForFunction(() => {
    const m = window.__squishy?.state();
    return m?.mode === 'idle' || m?.mode === 'intro';
  });
  await page.goBack();
  await expect(page.locator('#start')).toHaveClass(/show/);
});

test('picking a level from the picker: Back returns to the menu (no dangling picker)', async ({ page }) => {
  await boot(page);
  await page.click('#blevels');
  /* the "open" card pulses (animation) — force past the stability wait */
  await page.click('#levelsGrid .lvcard.open', { force: true });
  await page.waitForFunction(() => window.__squishy?.state().mode !== 'menu');
  await expect(page.locator('#levels')).not.toHaveClass(/show/);
  await page.goBack();
  await expect(page.locator('#start')).toHaveClass(/show/);
  await expect(page.locator('#levels')).not.toHaveClass(/show/);
});

test('builder still backs out to the menu (coexistence regression)', async ({ page }) => {
  await boot(page);
  await page.click('#bcreate');
  await page.waitForSelector('#builder.show', { timeout: 8000 });
  await page.goBack();
  await expect(page.locator('#builder')).not.toHaveClass(/show/);
  await expect(page.locator('#start')).toHaveClass(/show/);
});

test('a first-time visitor lands on the board, and Back still reaches the menu', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__squishy !== undefined);

  /* no title screen in the way — the game itself is the first thing they see */
  await expect(page.locator('#start')).not.toHaveClass(/show/);
  expect((await page.evaluate(() => window.__squishy?.state()))?.li).toBe(0);

  /* and the menu is not lost: Back pops the play entry onto it, never out */
  await page.goBack();
  await expect(page.locator('#start')).toHaveClass(/show/);
  expect(await page.evaluate(() => window.__squishy !== undefined), 'still in the app').toBe(true);
});
