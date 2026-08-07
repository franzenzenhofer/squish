/* The tutor hand in the REAL game: sit still on a tutorial level and the
   winning swipe must appear on its own, without costing the player a hint.
   Guards the biggest measured leak in the funnel — 39.5% of everyone who ever
   opened the game never cleared level 01, a one-swipe board. */
import { expect, test } from '@playwright/test';
import { HAND_IDLE_MS, HAND_LAST_LI } from '../../src/game/tutorHand';

/** generous margin over the idle beat: the hand is checked once per frame */
const WAIT = HAND_IDLE_MS + 2000;

test('points out the winning swipe when a tutorial player goes quiet', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__squishy !== undefined);
  /* boot lands on the title screen — a real player taps Play to reach a board */
  await page.getByRole('button', { name: /play|continue/i }).first().click();
  await page.evaluate(() => window.__squishy?.loadLevel(0));

  expect((await page.evaluate(() => window.__squishy?.state()))?.hintDir).toBeNull();

  /* poll: the arrow fades on its own after ~1.9s, so a fixed sample can miss it */
  await page.waitForFunction(
    () => window.__squishy?.state().hintDir != null, undefined, { timeout: WAIT }
  );
  const state = await page.evaluate(() => window.__squishy?.state());
  const solution = await page.evaluate(() => window.__squishy?.solution());
  expect(state?.hintDir).not.toBeNull();
  expect(state?.hintDir).toBe(solution?.[0]);
  /* it pointed for free: no move was spent and the board is still untouched */
  expect(state?.moves).toBe(0);
});

test('stays silent past the tutorial, where the coach takes over', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__squishy !== undefined);
  /* boot lands on the title screen — a real player taps Play to reach a board */
  await page.getByRole('button', { name: /play|continue/i }).first().click();
  await page.evaluate((li) => window.__squishy?.loadLevel(li), HAND_LAST_LI + 1);
  /* level 04 greets with two first-meet cards (penguin, ice) — clear them all,
     otherwise this test would pass merely because the board was never idle */
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__squishy?.dismissIntro());
    await page.waitForTimeout(300);
  }
  await page.waitForFunction(() => window.__squishy?.state().mode === 'idle');
  await page.waitForTimeout(WAIT);

  const state = await page.evaluate(() => window.__squishy?.state());
  expect(state?.li).toBe(HAND_LAST_LI + 1);
  expect(state?.mode).toBe('idle');
  expect(state?.hintDir).toBeNull();
});
