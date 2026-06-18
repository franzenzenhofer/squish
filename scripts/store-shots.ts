/* App Store SUBMISSION screenshots — CLEAN full-bleed (no captions, no frames):
   the REAL game is driven through window.__squishy / window.__squishBuilder to
   each scene, then captured edge-to-edge at Apple's exact device resolutions for
   BOTH the iPhone 6.9" slot (1290x2796) and the iPad 13" slot (2048x2732).
   The game's own layout() centres a SQUARE board inside whatever
   viewport it is given, so the iPad shots are genuine iPad portrait aspect, not a
   stretched phone. No mockups: every frame is the live build.
   Run: tsx scripts/store-shots.ts  (preview server must be up on :4378 — see
   npm run shots:store). */
import { chromium, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { LevelDef } from '../src/engine/types';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4378';
const OUT = 'appstore/store';

interface Device { id: string; width: number; height: number; dsf: number; }
/* logical viewport x deviceScaleFactor = the exact App Store pixel size */
const DEVICES: Device[] = [
  { id: 'iphone', width: 430, height: 932, dsf: 3 }, /* -> 1290 x 2796 (6.9" lead) */
  { id: 'ipad', width: 1024, height: 1366, dsf: 2 }  /* -> 2048 x 2732 (13" lead) */
];

/* A shipped, solver-proven campaign level (level 13 / index 12). chick, ice,
   wall, heart and squishy are all editor-native tools, so the editor opens on a
   rich, populated board AND the builder's solver confirms it solvable, which
   unlocks the Share button for the share-card shot. */
const BUILDER_DEF = {
  w: 5, h: 5, target: [3, 1], dots: [[0, 3], [0, 1]], par: 5,
  walls: [[4, 2]], ice: [[2, 0], [1, 0]], chicks: [[3, 4]]
} as unknown as LevelDef;

interface Shot { file: string; setup: (p: Page) => Promise<void>; }

const wait = (p: Page, ms: number): Promise<void> => p.waitForTimeout(ms);

/** Fresh page on the real build, storage wiped, animations made instant. */
async function bootClean(p: Page, hash = ''): Promise<void> {
  await p.goto(`${BASE}/?test=1${hash}`);
  await p.waitForFunction(() => window.__squishy !== undefined);
  await p.evaluate(() => {
    localStorage.clear();
    window.__squishy?.setInstantAnims(true);
  });
}

/** Tap through any first-meet intro cards until the board is interactive. */
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

/** Seed a satisfying progress so the start shelf and picker look played-in. */
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

/** Open the level editor on a populated, solver-proven board (Share unlocked). */
async function openBuilder(p: Page): Promise<void> {
  await bootClean(p);
  await p.evaluate((def) => window.__squishBuilder?.open(def), BUILDER_DEF);
  await p.waitForSelector('#builder.show', { timeout: 8000 });
  await p.waitForFunction(
    () => window.__squishBuilder?.getState().solveStatus === 'solvable',
    undefined, { timeout: 30000 }
  );
  await wait(p, 450);
}

const SHOTS: Shot[] = [
  /* 1 — Start screen */
  {
    file: '01_start',
    setup: async (p) => {
      await bootClean(p);
      await seedProgress(p, 11);
      await p.reload();
      await p.waitForFunction(() => window.__squishy !== undefined);
      await p.waitForSelector('#start.show', { timeout: 8000 });
      await wait(p, 500);
    }
  },
  /* 2 — High level one */
  { file: '02_level_a', setup: async (p) => { await bootClean(p); await gameplay(p, 45); } },
  /* 3 — Daily level (pre-solved manifest; allow a long timeout regardless) */
  {
    file: '03_daily',
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
  /* 4 — Chick intro overlay card (met flags wiped, so the card shows on load) */
  {
    file: '04_intro_chick',
    setup: async (p) => {
      await bootClean(p);
      await p.evaluate(() => window.__squishy?.closeMenu());
      await p.evaluate(() => window.__squishy?.loadLevel(12));
      /* the first-meet card adds #intro.show once applyLevel runs — wait on the
         DOM, not the racy settled-mode flag (which short-circuits on the menu) */
      await p.waitForSelector('#intro.show', { timeout: 30000 });
      await wait(p, 600); /* let the card slide fully in */
    }
  },
  /* 5 — High level two (full cast) */
  { file: '05_level_b', setup: async (p) => { await bootClean(p); await gameplay(p, 49); } },
  /* 6 — Level editor (populated board) */
  { file: '06_editor', setup: openBuilder },
  /* 7 — Level editor share card (QR + human-readable link) */
  {
    file: '07_editor_share',
    setup: async (p) => {
      await openBuilder(p);
      await p.evaluate(() => document.getElementById('bShare')?.click());
      await p.waitForFunction(
        () => document.getElementById('bShareSheet')?.dataset.shown === 'true',
        undefined, { timeout: 8000 }
      );
      await wait(p, 500);
    }
  },
  /* 8 — Win screen (replay the optimal solution to a real win card) */
  {
    file: '08_win',
    setup: async (p) => {
      await bootClean(p);
      await p.evaluate(() => window.__squishy?.loadLevel(48));
      await p.evaluate(() => window.__squishy?.closeMenu());
      await p.evaluate(() => window.__squishy?.solve()); /* AI-driveable: one call to the win */
      await p.waitForSelector('#win.show', { timeout: 15000 });
      await wait(p, 500); /* settle the win card (well before the 4s auto-advance) */
    }
  }
];

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const dev of DEVICES) {
    const ctx = await browser.newContext({
      viewport: { width: dev.width, height: dev.height },
      deviceScaleFactor: dev.dsf,
      isMobile: dev.id === 'iphone',
      hasTouch: true
    });
    const page = await ctx.newPage();
    for (const s of SHOTS) {
      process.stdout.write(`-> ${dev.id} ${s.file} ... `);
      await s.setup(page);
      const path = `${OUT}/${dev.id}_${s.file}.png`;
      const buf = await page.screenshot({ type: 'png' });
      writeFileSync(path, buf);
      process.stdout.write(`ok (${buf.length} B)\n`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\nDONE -> ${OUT}/  (${DEVICES.length * SHOTS.length} screenshots)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
