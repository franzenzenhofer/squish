/* Display-ad banners — drives the REAL app (via window.__squishBanners, which
   wraps src/game/banners.ts) so every gameplay pixel is the live renderer, not
   a mockup. Static PNG for every size; the two larger sizes also get an
   animated WebP, muxed from individual PNG frames by the `img2webp` CLI
   (part of Google's libwebp tools — `brew install webp`). Lossless, so the
   flat pastel art has no GIF-style 256-color banding.
   Run: tsx scripts/banner-shots.ts  (preview server must be up on :4378 — see
   npm run banners). */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4378';
const OUT = 'banners/out';
const WEIGHT_CAP_BYTES = 150 * 1024;

function checkWeight(bytes: number, file: string): void {
  if (bytes > WEIGHT_CAP_BYTES) {
    throw new Error(`${file} is ${bytes}B, over the ${WEIGHT_CAP_BYTES}B ad-network cap`);
  }
}

/** Mux base64 PNG frames + per-frame delays into a lossless animated WebP via
    the img2webp CLI — a real, well-tested muxer, not a hand-rolled RIFF
    container. Throws if img2webp isn't installed (`brew install webp`). */
function muxAnimatedWebp(frames: { png: string; delay: number }[], outPath: string): void {
  const dir = mkdtempSync(join(tmpdir(), 'squish-banner-'));
  try {
    /* LOSSY webp: VP8 at q80 keeps the flat pastel art + soft gradient clean (no
       GIF-style 256-colour banding), and at retina 2x with many frames stays
       under the 150KB ad-network cap (q92 blew it; motion hides the difference) */
    const args = ['-loop', '0', '-lossy', '-q', '80', '-m', '6'];
    frames.forEach((f, i) => {
      const framePath = join(dir, `f${i}.png`);
      writeFileSync(framePath, Buffer.from(f.png, 'base64'));
      args.push('-d', String(f.delay), framePath);
    });
    args.push('-o', outPath);
    execFileSync('img2webp', args, { stdio: 'pipe' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  /* wipe the dir first so stale files from a previous variant set never linger
     (the dir is gitignored — always a clean, exact regen) */
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE}/?test=1`);
  await page.waitForFunction(() => window.__squishBanners !== undefined);

  const combos = await page.evaluate(() => window.__squishBanners?.combos() ?? []);

  let count = 0;
  for (const combo of combos) {
    const base = `${combo.size}-${combo.variant}`;
    if (combo.animated) {
      process.stdout.write(`-> ${base}.webp ... `);
      const frames = await page.evaluate(
        ({ sk, vk }) => window.__squishBanners?.frames(sk, vk),
        { sk: combo.size, vk: combo.variant }
      );
      if (!frames || frames.length === 0) throw new Error(`${base}.webp: no frames returned`);
      const webpPath = `${OUT}/${base}.webp`;
      muxAnimatedWebp(frames, webpPath);
      const bytes = statSync(webpPath).size;
      checkWeight(bytes, `${base}.webp`);
      process.stdout.write(`ok (${frames.length} frames, ${bytes} B)\n`);
      count++;
      continue;
    }
    process.stdout.write(`-> ${base}.webp ... `);
    const b64 = await page.evaluate(
      ({ sk, vk }) => window.__squishBanners?.still(sk, vk),
      { sk: combo.size, vk: combo.variant }
    );
    if (!b64) throw new Error(`${base}.webp: no data returned`);
    const buf = Buffer.from(b64, 'base64');
    const webpPath = `${OUT}/${base}.webp`;
    writeFileSync(webpPath, buf);
    checkWeight(buf.length, `${base}.webp`);
    process.stdout.write(`ok (${buf.length} B)\n`);
    count++;
  }
  await browser.close();
  console.log(`\nDONE -> ${OUT}/  (${count} files)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
