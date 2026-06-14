/* Generate the social og:image: a SQUARE, high-resolution screenshot of a late,
   element-rich level rendered by the real game, captured straight from the live
   board canvas. Run: node scripts/gen-og.mjs  (writes public/og.png). */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const URL = process.env.OG_URL || 'https://squishy.franzai.com/?test=1';
const LEVEL = Number(process.env.OG_LEVEL || 49); // richest curated level (8 kinds, 7x7)

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1340 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__squishy, null, { timeout: 20000 });
await page.evaluate(async (lv) => {
  const s = window.__squishy;
  s.setInstantAnims(true);
  s.closeMenu();
  await s.loadLevel(lv);
  // dismiss any first-meet intro cards so the bare board shows
  for (let i = 0; i < 12 && s.state().mode === 'intro'; i++) {
    s.dismissIntro();
    await new Promise((r) => setTimeout(r, 150));
  }
}, LEVEL);
await page.waitForFunction(() => ['idle', 'win'].includes(window.__squishy.state().mode), null, { timeout: 20000 });
await page.waitForTimeout(900); // let the board bloom in and settle
await page.evaluate(() => {
  document.getElementById('cap')?.classList.remove('show');
  document.getElementById('intro')?.classList.remove('show');
});

const box = await page.locator('#c').boundingBox();
const side = Math.min(box.width, box.height);
await page.screenshot({
  path: 'public/og.png',
  clip: { x: box.x + (box.width - side) / 2, y: box.y + (box.height - side) / 2, width: side, height: side }
});
await browser.close();

const dims = execSync('sips -g pixelWidth -g pixelHeight public/og.png', { encoding: 'utf8' });
console.log('og.png written ->', dims.trim().replace(/\s+/g, ' '));
