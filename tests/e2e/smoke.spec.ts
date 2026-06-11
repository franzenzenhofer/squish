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

test('solver beats levels 1-5 with auto-advance', async ({ page }) => {
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
    /* the win modal auto-advances to the next level */
    await page.waitForFunction(
      (n) => {
        const m = window.__squishy?.state();
        return m?.li === n + 1 && (m.mode === 'idle' || m.mode === 'intro');
      },
      li, { timeout: 10000 }
    );
    await page.evaluate(() => window.__squishy?.dismissIntro());
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
  await page.evaluate(() => window.__squishy?.dismissIntro());
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

test('daily solve shows the congrats modal and returns to campaign', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => window.__squishy?.startDaily());
  await page.waitForFunction(() => {
    const m = window.__squishy?.state();
    return m !== undefined && m.play.startsWith('daily') && m.mode !== 'loading';
  }, undefined, { timeout: 120000 });
  await page.evaluate(() => {
    window.__squishy?.dismissIntro();
    window.__squishy?.dismissIntro();
    window.__squishy?.dismissIntro();
  });
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
  /* the congrats modal must appear (no auto-advance for dailies) */
  await page.waitForSelector('#dailyWin.show', { timeout: 10000 });
  expect(await page.textContent('#dwTitle')).toBe('Congrats!');
  expect(await page.textContent('#dwMoves')).toMatch(/Solved in \d+ moves/);
  await page.click('#dwContinue');
  await page.waitForFunction(() => {
    const m = window.__squishy?.state();
    return m?.play === 'campaign' && (m.mode === 'idle' || m.mode === 'intro');
  }, undefined, { timeout: 10000 });
});

test('mid-level state survives a reload', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => window.__squishy?.loadLevel(4));
  await page.evaluate(() => window.__squishy?.dismissIntro());
  await page.waitForFunction(() => window.__squishy?.state().oracleReady === true);
  const sol = await page.evaluate(() => window.__squishy?.solution());
  expect(sol && sol.length).toBeGreaterThan(2);
  await page.evaluate((d) => window.__squishy?.move(d as never), (sol as string[])[0]);
  await page.evaluate((d) => window.__squishy?.move(d as never), (sol as string[])[1]);
  const before = await page.evaluate(() => window.__squishy?.state());
  await page.reload();
  await page.waitForFunction(() => window.__squishy !== undefined);
  await page.evaluate(() => window.__squishy?.closeMenu());
  await page.waitForFunction(() => {
    const m = window.__squishy?.state();
    return m !== undefined && m.mode !== 'loading';
  });
  const after = await page.evaluate(() => window.__squishy?.state());
  expect(after?.li).toBe(before?.li);
  expect(after?.moves).toBe(before?.moves);
  expect(after?.ser).toBe(before?.ser);
});
