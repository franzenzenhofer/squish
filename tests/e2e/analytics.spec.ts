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

  /* exact shape: the event name plus the web platform tag, nothing else */
  expect(body).toEqual({ e: 'boot', p: 'web' });
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
