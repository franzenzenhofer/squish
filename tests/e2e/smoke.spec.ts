/* E2e smoke: the solver plays the real game in a real browser through the
   window.__squishy test API — levels 1-5 to the win, plus the oh-no
   guardrail on a computed trap line. */
import { expect, test } from '@playwright/test';
import { analyzeLevel, winnableState } from '../../src/engine/analyze';
import { DIRNAMES, cloneState, makeLevel, ser } from '../../src/engine/core';
import { move } from '../../src/engine/move';
import { readFileSync } from 'node:fs';
import type { Dir, GameState, LevelDef } from '../../src/engine/types';

const LEVELS = JSON.parse(
  readFileSync(new URL('../../src/levels.json', import.meta.url), 'utf8')
) as LevelDef[];

/** Shortest move line from the start into a provably dead state. */
function shortestTrapLine(def: LevelDef): Dir[] | null {
  const level = makeLevel(def);
  const oracle = analyzeLevel(level);
  const seen = new Set<string>([ser(level.initState)]);
  let frontier: Array<{ st: GameState; line: Dir[] }> = [
    { st: cloneState(level.initState), line: [] }
  ];
  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const n of frontier) {
      for (const d of DIRNAMES) {
        const r = move(level, n.st, d);
        if (!r.moved || r.state.dots.length === 0) continue;
        const k = ser(r.state);
        if (seen.has(k)) continue;
        seen.add(k);
        const line = [...n.line, d];
        if (winnableState(oracle, k) === false) return line;
        next.push({ st: r.state, line });
      }
    }
    frontier = next;
  }
  return null;
}

async function boot(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__squishy !== undefined);
  await page.evaluate(() => {
    window.__squishy?.setInstantAnims(true);
    window.__squishy?.closeMenu();
  });
}

/** Dismiss every queued first-meet card until play resumes. */
async function clearIntros(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    for (let i = 0; i < 40 && window.__squishy?.state().mode === 'intro'; i++) {
      window.__squishy.dismissIntro();
      await new Promise((r) => setTimeout(r, 16));
    }
  });
}

test('solver beats levels 1-5, advancing via the win card', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  for (let li = 0; li < 5; li++) {
    await page.evaluate((n) => window.__squishy?.loadLevel(n), li);
    await page.evaluate(() => window.__squishy?.dismissIntro());
    await page.waitForFunction(() => window.__squishy?.state().oracleReady === true);
    for (let i = 0; i < 30; i++) {
      const sol = await page.evaluate(() => window.__squishy?.solution());
      if (!sol || sol.length === 0) break;
      await page.evaluate((d) => window.__squishy?.move(d as never), sol[0]);
      const mode = await page.evaluate(() => window.__squishy?.state().mode);
      if (mode === 'win') break;
    }
    const st = await page.evaluate(() => window.__squishy?.state());
    expect(st?.mode, 'level ' + (li + 1) + ' should be won').toBe('win');
    /* the win card shows "Next ->"; tap it to advance to the next level */
    await page.waitForSelector('#win.show', { timeout: 10000 });
    await page.click('#winNext');
    await page.waitForFunction(
      (n) => {
        const m = window.__squishy?.state();
        return m?.li === n + 1 && (m.mode === 'idle' || m.mode === 'intro');
      },
      li, { timeout: 10000 }
    );
    await clearIntros(page);
  }
});

test('a trapping line triggers the oh-no auto-undo', async ({ page }) => {
  /* find the first curated level with a reachable dead state */
  let target = -1;
  let line: Dir[] | null = null;
  for (let i = 3; i < LEVELS.length; i++) {
    line = shortestTrapLine(LEVELS[i] as LevelDef);
    if (line) {
      target = i;
      break;
    }
  }
  expect(target, 'a curated level with a trap exists').toBeGreaterThan(-1);
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((n) => window.__squishy?.loadLevel(n), target);
  await clearIntros(page);
  await page.waitForFunction(() => window.__squishy?.state().oracleReady === true);
  for (const d of line as Dir[]) {
    await page.evaluate((dir) => window.__squishy?.move(dir as never), d);
  }
  /* the oh-no choreography must hop back to the pre-trap move count */
  await page.waitForFunction(
    (len) => {
      const m = window.__squishy?.state();
      return m?.mode === 'idle' && m.moves === len - 1 && m.winnable === true;
    },
    (line as Dir[]).length, { timeout: 10000 }
  );
});

test('daily solve shows the win card and returns to campaign', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => window.__squishy?.startDaily());
  await page.waitForFunction(() => {
    const m = window.__squishy?.state();
    return m !== undefined && m.play.startsWith('daily') && m.mode !== 'loading';
  }, undefined, { timeout: 120000 });
  await clearIntros(page);
  await page.waitForFunction(() => window.__squishy?.state().oracleReady === true,
    undefined, { timeout: 60000 });
  for (let i = 0; i < 16; i++) {
    const sol = await page.evaluate(() => window.__squishy?.solution());
    if (!sol || sol.length === 0) break;
    await page.evaluate((d) => window.__squishy?.move(d as never), sol[0]);
    const mode = await page.evaluate(() => window.__squishy?.state().mode);
    if (mode === 'win') break;
  }
  expect(await page.evaluate(() => window.__squishy?.state().mode)).toBe('win');
  /* the unified win card must appear (no auto-advance) */
  await page.waitForSelector('#win.show', { timeout: 10000 });
  /* the headline is a dynamic celebratory line - just assert one rendered */
  expect((await page.textContent('#winTitle'))?.trim().length).toBeGreaterThan(0);
  expect(await page.textContent('#winSub')).toMatch(/Daily .+ · solved in \d+ moves?/);
  await page.click('#winNext');
  await page.waitForFunction(() => {
    const m = window.__squishy?.state();
    return m?.play === 'campaign' && (m.mode === 'idle' || m.mode === 'intro');
  }, undefined, { timeout: 10000 });
});

test('a reload resumes the same level, fresh at its initial state', async ({ page }) => {
  /* mid-level progress is deliberately never persisted (see persist.ts):
     the level you were on comes back, at move zero */
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => window.__squishy?.loadLevel(4));
  await clearIntros(page);
  await page.waitForFunction(() => window.__squishy?.state().oracleReady === true);
  const fresh = await page.evaluate(() => window.__squishy?.state());
  const sol = await page.evaluate(() => window.__squishy?.solution());
  expect(sol && sol.length).toBeGreaterThan(2);
  await page.evaluate((d) => window.__squishy?.move(d as never), (sol as string[])[0]);
  await page.evaluate((d) => window.__squishy?.move(d as never), (sol as string[])[1]);
  await page.reload();
  await page.waitForFunction(() => window.__squishy !== undefined);
  await page.evaluate(() => window.__squishy?.closeMenu());
  await page.waitForFunction(() => {
    const m = window.__squishy?.state();
    return m !== undefined && m.mode !== 'loading';
  });
  const after = await page.evaluate(() => window.__squishy?.state());
  expect(after?.li).toBe(fresh?.li);
  expect(after?.moves).toBe(0);
  expect(after?.ser).toBe(fresh?.ser);
});

test('the board sits dead-centre in the play area', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => window.__squishy?.loadLevel(0));
  await clearIntros(page);
  await page.waitForFunction(() => window.__squishy?.state().mode === 'idle');
  const off = await page.evaluate(() => {
    const c = (document.getElementById('c') as HTMLElement).getBoundingClientRect();
    const m = (document.getElementById('main') as HTMLElement).getBoundingClientRect();
    return {
      dx: c.left + c.width / 2 - (m.left + m.width / 2),
      dy: c.top + c.height / 2 - (m.top + m.height / 2)
    };
  });
  expect(Math.abs(off.dx), 'board horizontally centred').toBeLessThanOrEqual(1.5);
  expect(Math.abs(off.dy), 'board vertically centred').toBeLessThanOrEqual(1.5);
});

test('a fresh player meets new friends and elements on first play', async ({ page }) => {
  /* first curated level that carries any intro-worthy friend or element */
  const KINDS = [
    'walls', 'stars', 'ice', 'jelly', 'mush', 'oneway', 'breeze', 'portals',
    'split', 'turn', 'sticky', 'noms', 'penguins', 'bears', 'ghosts', 'bunnies',
    'frogs', 'pandas', 'cats', 'chicks', 'pigs', 'boxes', 'balloons', 'snails'
  ];
  const introLevel = LEVELS.findIndex((d) => {
    const rec = d as unknown as Record<string, unknown[]>;
    return KINDS.some((k) => Array.isArray(rec[k]) && rec[k].length > 0);
  });
  expect(introLevel, 'a curated level with an element exists').toBeGreaterThan(-1);
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  /* never-met cast -> entering the level must raise a first-meet card that
     sits ON TOP (its own overlay), not behind the closed menu */
  await page.evaluate((n) => window.__squishy?.loadLevel(n), introLevel);
  await page.waitForFunction(() => window.__squishy?.state().mode === 'intro',
    undefined, { timeout: 5000 });
  expect(await page.evaluate(
    () => document.getElementById('intro')?.classList.contains('show')
  )).toBe(true);
  /* dismissing the whole queue returns to play */
  await clearIntros(page);
  expect(await page.evaluate(() => window.__squishy?.state().mode)).toBe('idle');
});

test('tap-to-explain: pillow + heart open cards; the squishy is petted', async ({ page }) => {
  const li = LEVELS.findIndex((d) => Array.isArray(d.walls) && d.walls.length > 0);
  expect(li, 'a curated level with a wall exists').toBeGreaterThan(-1);
  const lvl = LEVELS[li] as LevelDef;
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((n) => window.__squishy?.loadLevel(n), li);
  await clearIntros(page);
  await page.waitForFunction(() => window.__squishy?.state().mode === 'idle');

  const wall = (lvl.walls as [number, number][])[0] as [number, number];
  await page.evaluate(([x, y]) => window.__squishy?.tapCell(x, y), wall);
  await page.waitForSelector('#intro.show', { timeout: 4000 });
  expect(await page.textContent('#introName')).toBe('Pillow');
  await page.evaluate(() => window.__squishy?.dismissIntro());

  await page.evaluate(([x, y]) => window.__squishy?.tapCell(x, y), lvl.target);
  await page.waitForSelector('#intro.show', { timeout: 4000 });
  expect(await page.textContent('#introName')).toBe('The Heart');
  await page.evaluate(() => window.__squishy?.dismissIntro());

  /* tapping your own squishy pets it: stays idle, no card */
  const dot = lvl.dots[0] as [number, number];
  await page.evaluate(([x, y]) => window.__squishy?.tapCell(x, y), dot);
  expect(await page.evaluate(() => window.__squishy?.state().mode)).toBe('idle');
  expect(await page.evaluate(
    () => document.getElementById('intro')?.classList.contains('show')
  )).toBe(false);
});

/** Drive the current level to the win using the oracle's solution. */
async function solveCurrent(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(() => window.__squishy?.state().oracleReady === true);
  for (let i = 0; i < 30; i++) {
    const sol = await page.evaluate(() => window.__squishy?.solution());
    if (!sol || sol.length === 0) break;
    await page.evaluate((d) => window.__squishy?.move(d as never), sol[0]);
    if (await page.evaluate(() => window.__squishy?.state().mode) === 'win') break;
  }
  expect(await page.evaluate(() => window.__squishy?.state().mode)).toBe('win');
}

test("settings 'instant': a win zooms straight into the next level, no card", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => window.__squishy?.setSettings({ afterWin: 'instant' }));
  await page.evaluate(() => window.__squishy?.loadLevel(3));
  await clearIntros(page);
  await solveCurrent(page);
  /* no win card — the flood drains into level 5 by itself */
  await page.waitForFunction(() => {
    const m = window.__squishy?.state();
    return m?.li === 4 && (m.mode === 'idle' || m.mode === 'intro');
  }, undefined, { timeout: 10000 });
  expect(await page.evaluate(
    () => document.getElementById('win')?.classList.contains('show'))).toBe(false);
});

test("settings 'wait': the win card shows without the countdown ring", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => window.__squishy?.setSettings({ afterWin: 'wait' }));
  await page.evaluate(() => window.__squishy?.loadLevel(3));
  await clearIntros(page);
  await solveCurrent(page);
  await page.waitForSelector('#win.show', { timeout: 10000 });
  expect(await page.evaluate(
    () => document.getElementById('winNext')?.classList.contains('counting'))).toBe(false);
});

test('settings hide the hint button and the labels', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => window.__squishy?.loadLevel(0));
  await clearIntros(page);
  /* level 1 shows labels by default */
  expect(await page.evaluate(
    () => document.querySelector('footer')?.classList.contains('labels'))).toBe(true);
  await page.evaluate(() => window.__squishy?.setSettings({ hintButton: false, buttonLabels: false }));
  expect(await page.locator('#toolHint').isVisible()).toBe(false);
  expect(await page.evaluate(
    () => document.querySelector('footer')?.classList.contains('labels'))).toBe(false);
});

test('a hinted win earns zero hearts and a friendly line', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => window.__squishy?.loadLevel(3));
  await clearIntros(page);
  await page.evaluate(() => window.__squishy?.toggleHintMode());
  await solveCurrent(page);
  await page.waitForSelector('#win.show', { timeout: 10000 });
  expect(await page.locator('#winTag .rate .rh.on').count()).toBe(0);
});

test('?debug=doit: picker unlocks everything, test levels fire the oh-no', async ({ page }) => {
  await page.goto('/?test=1&debug=doit');
  await page.waitForFunction(() => window.__squishy !== undefined);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => {
    window.__squishy?.setInstantAnims(true);
    window.__squishy?.closeMenu();
  });
  await clearIntros(page);
  /* the debug picker: no padlocks, generated ladder + test list + baker */
  await page.evaluate(() => document.getElementById('blevels')?.click());
  await page.waitForSelector('#levels.show', { timeout: 5000 });
  expect(await page.locator('#levelsGrid .lvchip.locked').count()).toBe(0);
  expect(await page.locator('#levelsGen .lvchip').count()).toBe(10);
  expect(await page.locator('.lvtest button').count()).toBeGreaterThanOrEqual(8);
  expect(await page.locator('.lvbake .bkgo').count()).toBe(1);
  /* the oh-no trap level: a dead opening must hop back automatically */
  await page.evaluate(() => window.__squishy?.loadTestLevel(0));
  await clearIntros(page);
  await page.waitForFunction(() => window.__squishy?.state().oracleReady === true);
  await page.evaluate(() => window.__squishy?.move('up' as never));
  await page.waitForFunction(() => {
    const m = window.__squishy?.state();
    return m?.mode === 'idle' && m.moves === 0 && m.winnable === true;
  }, undefined, { timeout: 10000 });
});

test('settings link opens the closeable privacy statement', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => document.getElementById('bsettings')?.click());
  await page.waitForSelector('#settings.show', { timeout: 5000 });
  await page.evaluate(() => document.getElementById('bprivacy')?.click());
  await page.waitForSelector('#privacy.show', { timeout: 5000 });
  const text = (await page.textContent('#privacyCard')) ?? '';
  expect(text).toContain('No cookies');
  expect(text.toLowerCase()).toContain('anonymous');
  await page.evaluate(() => document.getElementById('bpback')?.click());
  expect(await page.evaluate(
    () => document.getElementById('privacy')?.classList.contains('show'))).toBe(false);
});

test('a win fires one anonymous beacon to /t', async ({ page }) => {
  const beacons: string[] = [];
  await page.route('**/t', async (route) => {
    beacons.push(route.request().postData() ?? '');
    await route.fulfill({ status: 204 });
  });
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => window.__squishy?.loadLevel(3));
  await clearIntros(page);
  await solveCurrent(page);
  await page.waitForFunction(() => window.__squishy?.state().mode === 'win');
  await expect.poll(() => beacons.filter((b) => b.includes('"win"')).length).toBe(1);
  const win = JSON.parse(beacons.find((b) => b.includes('"win"')) ?? '{}');
  /* the anonymity contract: only whitelisted keys, numbers + the kind letter */
  expect(Object.keys(win).sort()).toEqual(
    expect.arrayContaining(['e', 'k', 'li', 'mv']));
  for (const [k, v] of Object.entries(win)) {
    expect(['e', 'k', 'li', 'mv', 'par', 'hr', 'hd']).toContain(k);
    if (k !== 'e' && k !== 'k') expect(typeof v).toBe('number');
  }
  expect(win.li).toBe(3);
});

test('the header never shows a star pill', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  const starLi = LEVELS.findIndex((d) => Array.isArray(d.stars) && d.stars.length > 0);
  await page.evaluate((n) => window.__squishy?.loadLevel(n), starLi >= 0 ? starLi : 0);
  await clearIntros(page);
  expect(await page.locator('#starpill').count()).toBe(0);
});
