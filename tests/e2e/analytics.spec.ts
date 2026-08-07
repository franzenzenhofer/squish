/* E2e integration for the two-target analytics seam (web side): the REAL built
   client, in a real browser, fires its anonymous boot beacon through the real
   navigator.sendBeacon, tagged with the web platform flag and carrying nothing
   identifying. This is the end-to-end proof that the platform tag survives the
   actual build and transport - the unit tests prove the schema, this proves the
   wiring. */
import { expect, test } from '@playwright/test';

test('boot fires an anonymous beacon tagged platform=web', async ({ page }) => {
  /* arm the wait BEFORE navigating: the boot beacon fires the moment the game
     becomes ready, fire-and-forget, so we must already be listening */
  const bootBeacon = page.waitForRequest(
    (r) => r.url().endsWith('/t') && r.method() === 'POST',
    { timeout: 15000 }
  );

  await page.goto('/');
  const req = await bootBeacon;
  const body = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>;

  /* the event name + web platform tag + the daily-rotating anonymous token (a
     short random value, issue #6), and nothing else */
  expect(body.e).toBe('boot');
  expect(body.p).toBe('web');
  expect(body.t).toMatch(/^[a-z0-9]{1,16}$/);
  expect(Object.keys(body).sort()).toEqual(['e', 'p', 't']);
  /* the anonymity contract holds over the wire too */
  expect(req.postData() ?? '').not.toMatch(/userId|email|cookie|ip|ua/i);
});

test('the game signals readiness for the iOS wrapper', async ({ page }) => {
  /* the ios-app-maker GameWebView holds its splash until window.__ready is true;
     prove the web build sets it (the iOS build shares this exact code path) */
  await page.goto('/');
  await page.waitForFunction(
    () => (window as unknown as { __ready?: boolean }).__ready === true,
    undefined,
    { timeout: 15000 }
  );
});

test('no phantom start: the title screen fires boot only, Play fires the start', async ({ page }) => {
  const beacons: Record<string, unknown>[] = [];
  await page.route('**/t', (route) => {
    beacons.push(JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>);
    return route.fulfill({ status: 204, body: '' });
  });

  /* the phantom start was born on the RETURNING player's path: the menu greets
     them while boot applies the resumed level behind it. Seed progress so this
     test exercises exactly that path. */
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('squish-progress-v2', JSON.stringify({
      v: 2, play: { kind: 'campaign' }, li: 1, def: null,
      results: { 0: 3 }, hinted: {}, daily: {}
    }));
  });
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__squishy !== undefined);
  await page.waitForTimeout(1500);

  /* the level is applied behind the start menu — that must NOT count as a start */
  expect(beacons.filter((b) => b.e === 'start')).toHaveLength(0);
  expect(beacons.filter((b) => b.e === 'boot')).toHaveLength(1);

  /* tapping Play puts a real board in front of the player: exactly one start */
  await page.getByRole('button', { name: /play|continue/i }).first().click();
  await page.waitForTimeout(1500);
  expect(beacons.filter((b) => b.e === 'start')).toHaveLength(1);
});
