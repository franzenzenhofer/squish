/* Generate the social og:image: a 1200x630 (1.91:1, OG best-practice) card that
   shows the REAL game running a late, element-rich level inside an iPhone frame
   on the left, with the SSOT "Squishy & Friends" wordmark and a row of real
   friend sprites on the right. Everything is pulled live from the actual game
   (the game UI screenshot, the logo markup, the sprite painters) so the card can
   never drift from the product. Writes public/og.png (2400x1260 @2x).

   Run against a LOCAL preview (needs the iconURL test hook + current build):
     npm run build && vite preview --port 4379 &
     OG_URL=http://localhost:4379/?test=1 node scripts/gen-og.mjs */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const URL = process.env.OG_URL || 'http://localhost:4379/?test=1';
const LEVEL = Number(process.env.OG_LEVEL || 49); // richest curated level (8 kinds, 7x7)
const FRIENDS = ['squishy', 'ghost', 'chick', 'bunny'];

const browser = await chromium.launch();

/* ---- Phase A: capture the live game (iPhone viewport), logo, friends ------ */
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3
});
const page = await phone.newPage();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__squishy, null, { timeout: 20000 });
await page.evaluate(async (lv) => {
  const s = window.__squishy;
  s.setInstantAnims(true);
  s.closeMenu();
  await s.loadLevel(lv);
  for (let i = 0; i < 12 && s.state().mode === 'intro'; i++) {
    s.dismissIntro();
    await new Promise((r) => setTimeout(r, 120));
  }
}, LEVEL);
await page.waitForFunction(
  () => ['idle', 'win'].includes(window.__squishy.state().mode), null, { timeout: 20000 }
);
await page.waitForTimeout(900); // let the board bloom in and settle
await page.evaluate(() => {
  document.getElementById('cap')?.classList.remove('show');
  document.getElementById('intro')?.classList.remove('show');
});
const screenBuf = await page.screenshot();

const logoSvg = await page.evaluate(() => {
  const svg = document.querySelector('#logo .logo-svg') || document.querySelector('.logo-svg');
  if (!svg) return '';
  const clone = svg.cloneNode(true);
  const src = svg.querySelectorAll('path');
  const dst = clone.querySelectorAll('path');
  src.forEach((p, i) => {
    const cs = window.getComputedStyle(p);
    dst[i].setAttribute('fill', cs.fill);
    if (cs.stroke && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) {
      dst[i].setAttribute('stroke', cs.stroke);
      dst[i].setAttribute('stroke-width', cs.strokeWidth);
      dst[i].setAttribute('stroke-linejoin', 'round');
      dst[i].setAttribute('paint-order', 'stroke');
    }
  });
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  return clone.outerHTML;
});

const friendURLs = await page.evaluate(
  (names) => names.map((n) => window.__squishy.iconURL(n)), FRIENDS
);

/* ---- Phase B: compose the 1200x630 card ----------------------------------- */
const screenDataUrl = 'data:image/png;base64,' + screenBuf.toString('base64');
const friendImgs = friendURLs.map((u) => `<img class="fr" src="${u}">`).join('');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  .stage {
    width: 1200px; height: 630px; display: flex; align-items: center;
    background:
      radial-gradient(120% 90% at 18% 12%, #FFFFFF 0%, #FFF1F7 42%, #FCDDEC 100%);
    font-family: system-ui, -apple-system, sans-serif; overflow: hidden;
  }
  .left { width: 470px; position: relative; display: flex; justify-content: center; align-items: center; }
  .left::after {
    content: ''; position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%);
    width: 300px; height: 46px; border-radius: 50%;
    background: radial-gradient(closest-side, rgba(120,40,80,.22), rgba(120,40,80,0));
  }
  .phone {
    position: relative; z-index: 1; width: 268px; height: 574px; background: #0e1013;
    border-radius: 56px; padding: 13px;
    box-shadow: 0 34px 70px rgba(120,40,80,.30), 0 8px 22px rgba(120,40,80,.18),
      inset 0 0 0 2px #303338, inset 0 0 0 6px #0e1013;
  }
  .screen {
    width: 100%; height: 100%; border-radius: 44px; overflow: hidden; background: #000;
  }
  .screen img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
  .island {
    position: absolute; top: 26px; left: 50%; transform: translateX(-50%);
    width: 88px; height: 26px; background: #000; border-radius: 14px;
  }
  .right {
    flex: 1; height: 100%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 34px; padding: 0 52px 0 20px;
  }
  .logo { width: 580px; max-width: 100%; }
  .logo svg { width: 100%; height: auto; display: block; overflow: visible; }
  .friends { display: flex; align-items: flex-end; gap: 6px; }
  .fr { width: 136px; height: 136px; display: block;
        filter: drop-shadow(0 12px 11px rgba(150,70,110,.20)); }
</style></head><body>
  <div class="stage">
    <div class="left">
      <div class="phone">
        <div class="screen"><img src="${screenDataUrl}"></div>
        <div class="island"></div>
      </div>
    </div>
    <div class="right">
      <div class="logo">${logoSvg}</div>
      <div class="friends">${friendImgs}</div>
    </div>
  </div>
</body></html>`;

const stage = await browser.newContext({
  viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2
});
const card = await stage.newPage();
await card.setContent(html, { waitUntil: 'load' });
await card.evaluate(() => Promise.all(
  Array.from(document.images).map((img) => img.complete
    ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; }))
));
await card.waitForTimeout(250);
await card.screenshot({ path: 'public/og.png' });
await browser.close();

/* shrink for fast social unfurling (lossy but visually lossless here) */
try {
  execSync('pngquant --quality=82-96 --force --output public/og.png public/og.png', { stdio: 'ignore' });
} catch {
  console.warn('pngquant not available - shipping the unoptimized PNG');
}

const dims = execSync('sips -g pixelWidth -g pixelHeight public/og.png', { encoding: 'utf8' });
const kb = Math.round(execSync('wc -c < public/og.png', { encoding: 'utf8' }).trim() / 1024);
console.log('og.png written ->', dims.trim().replace(/\s+/g, ' '), '|', kb + 'KB');
