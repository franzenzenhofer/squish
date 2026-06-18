/* The AI-driveable state contract: an agent (or screenshot script) must be able
   to drive the game to any scene with simple, deterministic calls — no secret
   "load, then separately wait for the oracle, then loop the solution" incantation.
   loadLevel must leave the requested level fully ready, and solve() must carry the
   current level all the way to the win card. */
import { expect, test } from '@playwright/test';

async function boot(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__squishy !== undefined);
  await page.evaluate(() => {
    localStorage.clear();
    window.__squishy?.setInstantAnims(true);
    window.__squishy?.closeMenu();
  });
}

test('loadLevel leaves the level fully AI-driveable: the requested level is active, the oracle is ready, and a solution is available the moment it resolves', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__squishy?.loadLevel(45));
  /* no separate oracle wait, no clearIntros — resolving loadLevel is the contract */
  const st = await page.evaluate(() => window.__squishy?.state());
  expect(st?.li, 'the requested level is the active level').toBe(45);
  expect(st?.oracleReady, 'the oracle is ready').toBe(true);
  const sol = await page.evaluate(() => window.__squishy?.solution());
  expect(sol?.length ?? 0, 'a solution is immediately available').toBeGreaterThan(0);
});

test('solve() drives the current level all the way to the win, dismissing intro cards on the way', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__squishy?.loadLevel(48));
  const mode = await page.evaluate(() => window.__squishy?.solve());
  expect(mode, 'solve() reports the level won').toBe('win');
  const st = await page.evaluate(() => window.__squishy?.state());
  expect(st?.mode, 'the game is on the win card').toBe('win');
});
