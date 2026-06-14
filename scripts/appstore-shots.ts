/* App Store screenshots — drives the REAL game (via window.__squishy) to each
   best-moment state, captures at true 6.9" retina, then composes branded
   caption screenshots at Apple's exact 1320x2868 spec (the required iPhone
   6.9" lead size for 2026 submissions). No mockups, no fakes: every frame is
   the live build. Run: tsx scripts/appstore-shots.ts  (preview server must be
   up on :4378 — see npm run shots). */
import { chromium, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4378';
const OUT = 'appstore/out';
const RAW = 'appstore/raw';
/* 6.9" iPhone (16/17 Pro Max): 1320x2868 device px = 440x956 logical @3x */
const DEV = { width: 440, height: 956, dsf: 3 };
const CANVAS = { w: 1320, h: 2868 };

interface Shot {
  file: string;
  headline: string;
  setup: (p: Page) => Promise<void>;
}

const wait = (p: Page, ms: number): Promise<void> => p.waitForTimeout(ms);

async function bootClean(p: Page, hash = ''): Promise<void> {
  await p.goto(`${BASE}/?test=1${hash}`);
  await p.waitForFunction(() => window.__squishy !== undefined);
  await p.evaluate(() => {
    localStorage.clear();
    window.__squishy?.setInstantAnims(true);
  });
}

async function clearIntros(p: Page): Promise<void> {
  await p.evaluate(async () => {
    for (let i = 0; i < 40 && window.__squishy?.state().mode === 'intro'; i++) {
      window.__squishy.dismissIntro();
      await new Promise((r) => setTimeout(r, 16));
    }
  });
}

/** Load a campaign level and settle to a clean idle board, menu closed. */
async function gameplay(p: Page, idx: number): Promise<void> {
  await p.evaluate((n) => window.__squishy?.loadLevel(n), idx);
  await clearIntros(p);
  await p.evaluate(() => window.__squishy?.closeMenu());
  await p.waitForFunction(() => window.__squishy?.state().mode === 'idle');
  await wait(p, 350); /* let the entrance settle / squishies idle-breathe */
}

/** Seed a satisfying progress so the picker shows unlocked, hearted levels. */
async function seedProgress(p: Page, upTo: number): Promise<void> {
  await p.evaluate((n) => {
    const results: Record<number, number> = {};
    for (let i = 0; i < n; i++) results[i] = 3;
    localStorage.setItem('squish-progress-v2', JSON.stringify({
      v: 2, play: { kind: 'campaign' }, li: n, def: null,
      results, hinted: {}, daily: {}
    }));
  }, upTo);
}

const SHOTS: Shot[] = [
  {
    file: '01-hero',
    headline: 'Squish them onto the heart',
    setup: async (p) => {
      await bootClean(p);
      await seedProgress(p, 11);
      await p.reload();
      await p.waitForFunction(() => window.__squishy !== undefined);
      await p.waitForSelector('#start.show', { timeout: 8000 });
      await wait(p, 500);
    }
  },
  {
    file: '02-slide',
    headline: 'Slide to merge your squishies',
    setup: async (p) => { await bootClean(p); await gameplay(p, 3); }
  },
  {
    file: '03-twists',
    headline: 'Cozy puzzles, clever twists',
    setup: async (p) => { await bootClean(p); await gameplay(p, 45); }
  },
  {
    file: '04-friends',
    headline: 'A whole world of friends',
    setup: async (p) => { await bootClean(p); await gameplay(p, 49); }
  },
  {
    file: '05-daily',
    headline: 'A fresh puzzle every day',
    setup: async (p) => {
      await bootClean(p);
      await p.evaluate(() => window.__squishy?.startDaily());
      await p.waitForFunction(() => {
        const m = window.__squishy?.state();
        return m !== undefined && m.play.startsWith('daily') && m.mode !== 'loading';
      }, undefined, { timeout: 120000 });
      await clearIntros(p);
      await p.evaluate(() => window.__squishy?.closeMenu());
      await p.waitForFunction(() => window.__squishy?.state().mode === 'idle');
      await wait(p, 350);
    }
  },
  {
    file: '06-levels',
    headline: '50 levels and an endless ladder',
    setup: async (p) => {
      await bootClean(p);
      await seedProgress(p, 40);
      await p.reload();
      await p.waitForFunction(() => window.__squishy !== undefined);
      await p.evaluate(() => window.__squishy?.closeMenu());
      await p.evaluate(() => document.getElementById('blevels')?.click());
      await p.waitForSelector('#levels.show', { timeout: 5000 });
      await wait(p, 500);
    }
  }
];

function composeHTML(headline: string, dataUrl: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Fredoka';font-weight:300 700;font-display:block;
    src:url('${BASE}/fonts/fredoka-latin.woff2') format('woff2');}
  *{margin:0;box-sizing:border-box}
  html,body{width:${CANVAS.w}px;height:${CANVAS.h}px;overflow:hidden}
  body{position:relative;display:flex;flex-direction:column;align-items:center;
    font-family:'Fredoka',ui-rounded,system-ui,sans-serif;
    background:radial-gradient(130% 80% at 50% -10%,#FFFAFC 0%,#FFEFF6 44%,#FFE2EE 100%);}
  .blob{position:absolute;border-radius:50%;filter:blur(3px);opacity:.55;pointer-events:none}
  .b1{width:520px;height:520px;background:#FFE0EC;left:-160px;top:8%}
  .b2{width:600px;height:600px;background:#FFEAD6;right:-220px;bottom:-160px}
  .cap{margin-top:158px;height:300px;width:1140px;display:flex;align-items:center;
    justify-content:center;text-align:center;color:#6B4A5B;font-weight:700;
    font-size:96px;line-height:1.05;letter-spacing:.01em;z-index:2}
  .frame{margin-top:34px;width:1062px;background:#fff;border-radius:66px;padding:21px;
    box-shadow:0 46px 100px rgba(226,85,127,.30),0 8px 22px rgba(226,85,127,.18);z-index:2}
  .frame img{display:block;width:100%;border-radius:46px}
  </style></head><body>
  <div class="blob b1"></div><div class="blob b2"></div>
  <div class="cap">${headline}</div>
  <div class="frame"><img src="${dataUrl}"></div>
  </body></html>`;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(RAW, { recursive: true });
  const browser = await chromium.launch();
  const gameCtx = await browser.newContext({
    viewport: { width: DEV.width, height: DEV.height },
    deviceScaleFactor: DEV.dsf, isMobile: true, hasTouch: true
  });
  const game = await gameCtx.newPage();
  const designCtx = await browser.newContext({
    viewport: { width: CANVAS.w, height: CANVAS.h }, deviceScaleFactor: 1
  });
  const design = await designCtx.newPage();

  for (const s of SHOTS) {
    process.stdout.write(`-> ${s.file} ... `);
    await s.setup(game);
    const raw = await game.screenshot({ type: 'png' });
    writeFileSync(`${RAW}/${s.file}.png`, raw);
    const dataUrl = `data:image/png;base64,${raw.toString('base64')}`;
    await design.setContent(composeHTML(s.headline, dataUrl), { waitUntil: 'load' });
    await design.evaluate(() => document.fonts.ready);
    await design.waitForTimeout(250);
    await design.screenshot({ path: `${OUT}/${s.file}.png` });
    process.stdout.write(`ok (raw ${raw.length} B)\n`);
  }
  await browser.close();
  console.log(`\nDONE -> ${OUT}/  (${SHOTS.length} screenshots @ ${CANVAS.w}x${CANVAS.h})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
