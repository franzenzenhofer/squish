/* Pinned-level store (SSOT) — read / write / re-solve any shipped campaign level
   1..200 by its level NUMBER (1-based), regardless of which file it lives in.

   Levels 1..50 live eagerly in src/levels.json (an array, index = n-1) so the
   core game loads them in the main bundle. Levels 51..200 live in the lazy
   src/levels-verified.json chunk so phones don't pay for them up front. That
   split is a LOADING decision only: both are pinned, pre-solved, hand-editable
   boards with the identical shape and the identical workflow. This module hides
   the split so callers (the single-level resolver, the easing pass, tests) treat
   the whole 1..200 ladder as one editable dataset.

   The board is the source of truth; par + sol are DERIVED. Hand-edit a board,
   call resolveDef (or `npm run level:resolve <n>`), and par/sol are recomputed
   from scratch — no generator, no full re-bake. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIRCODE, cloneState, isWin, makeLevel } from '../src/engine/core';
import { move } from '../src/engine/move';
import { solve } from '../src/engine/solve';
import type { Dir, DirCode, LevelDef } from '../src/engine/types';

export const CURATED_END = 50; // levels 1..50 are the eager curated set

const root = process.cwd();
const CURATED_FILE = join(root, 'src', 'levels.json');
const VERIFIED_FILE = join(root, 'src', 'levels-verified.json');

interface VerifiedManifest { v: number; fp: string; generatedAt: string; levels: Record<string, LevelDef>; }

function readCurated(): LevelDef[] {
  return JSON.parse(readFileSync(CURATED_FILE, 'utf8')) as LevelDef[];
}
function readVerified(): VerifiedManifest {
  return JSON.parse(readFileSync(VERIFIED_FILE, 'utf8')) as VerifiedManifest;
}

/** Highest shipped level number (200 unless the manifest grows). */
export function lastLevel(): number {
  return Math.max(...Object.keys(readVerified().levels).map(Number));
}

/** The pinned board for level number n (1-based), from whichever file holds it. */
export function loadLevel(n: number): LevelDef {
  if (n < 1) throw new Error('level number is 1-based, got ' + n);
  if (n <= CURATED_END) {
    const def = readCurated()[n - 1];
    if (!def) throw new Error('curated level ' + n + ' missing');
    return def;
  }
  const def = readVerified().levels[String(n)];
  if (!def) throw new Error('verified level ' + n + ' missing');
  return def;
}

/** Write the pinned board for level number n back to its file (in place). */
export function saveLevel(n: number, def: LevelDef): void {
  if (n <= CURATED_END) {
    const all = readCurated();
    all[n - 1] = def;
    writeFileSync(CURATED_FILE, JSON.stringify(all));
    return;
  }
  const m = readVerified();
  m.levels[String(n)] = def;
  writeFileSync(VERIFIED_FILE, JSON.stringify(m) + '\n');
}

/** True if the def's sol string really replays to a win. */
export function replayWins(def: LevelDef): boolean {
  const level = makeLevel(def);
  let st = cloneState(level.initState);
  for (const c of (def.sol ?? '').split('') as DirCode[]) {
    const r = move(level, st, { U: 'up', D: 'down', L: 'left', R: 'right' }[c] as Dir);
    if (!r.moved) return false;
    st = r.state;
  }
  return isWin(level, st);
}

/** Recompute par + sol for a board from scratch (board is the source of truth).
    Returns a new def with derived par/sol; throws if the board is unsolvable. */
export function resolveDef(def: LevelDef): LevelDef {
  const level = makeLevel(def);
  const res = solve(level, { maxStates: 800000, maxDepth: 40 });
  if (res.status !== 'solved') throw new Error('board does not solve (' + res.status + ')');
  const sol = res.solution.map((d: Dir) => DIRCODE[d]).join('');
  const out: LevelDef = { ...def, par: res.par, sol };
  if (!replayWins(out)) throw new Error('recomputed sol does not replay to a win');
  return out;
}
