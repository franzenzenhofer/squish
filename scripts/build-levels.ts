/* Build the 40 curated levels: generate, minimality-pass, verify, write
   src/levels.json.

   GUARD: src/levels.json is the canonical PINNED level set (Franz, 2026-06-12:
   the original hand-tuned curve plays better than a constrained regeneration -
   never silently replace it). This script REFUSES to overwrite it unless
   FORCE_LEVELS=1 is set, so a casual rebuild can never destroy the curve. */
import { writeFileSync } from 'node:fs';

if (process.env.FORCE_LEVELS !== '1') {
  console.error('refusing to overwrite the pinned src/levels.json - the curated');
  console.error('curve is hand-tuned. Run with FORCE_LEVELS=1 only if you really');
  console.error('mean to regenerate every level.');
  process.exit(1);
}
import { CODEDIR, DIRCODE, cloneState, isWin, makeLevel } from '../src/engine/core';
import { move } from '../src/engine/move';
import { solve, spamSolvable } from '../src/engine/solve';
import type { Dir, DirCode, LevelDef, XY } from '../src/engine/types';
import { FIXED_LEVELS, generateLevel, trapFree } from '../src/gen/generate';
import { ramp } from '../src/gen/ramp';

/* No per-level captions: every element/friend is explained ONLY by its overlay
   (first-meet + tap-to-explain), never as a speech bubble. A bubble explaining a
   thing that also has an overlay is a double-notification - banned. The two
   genuine coaching lines (L1 swipe, L2 merge+goal) live in TUTORIALS, not here. */

function replayWins(def: LevelDef): boolean {
  const level = makeLevel(def);
  let st = cloneState(level.initState);
  for (const c of (def.sol ?? '').split('') as DirCode[]) {
    const r = move(level, st, CODEDIR[c]);
    if (!r.moved) return false;
    st = r.state;
  }
  return isWin(level, st);
}

/** Drop walls that change nothing — cleaner boards, same puzzle. A removal
    must keep par, stay spam-proof AND stay free of early dead states. */
function minimize(def: LevelDef): LevelDef {
  let cur = def;
  let walls = cur.walls ?? [];
  for (let i = walls.length - 1; i >= 0; i--) {
    const trial: LevelDef = { ...cur, walls: walls.filter((_, j) => j !== i) };
    if (trial.walls && trial.walls.length === 0) delete trial.walls;
    const level = makeLevel(trial);
    const res = solve(level, { maxStates: 400000, maxDepth: cur.par + 1 });
    if (res.status !== 'solved' || res.par !== cur.par) continue;
    if (spamSolvable(level, res.par)) continue;
    if (!trapFree(trial)) continue;
    cur = { ...trial, sol: res.solution.map((d: Dir) => DIRCODE[d]).join('') };
    walls = cur.walls ?? [];
  }
  return cur;
}

const levels: LevelDef[] = [];
const t0 = Date.now();
for (let n = 1; n <= 40; n++) {
  const s = Date.now();
  let def = generateLevel(n);
  /* fixed feature-intro levels are authored exactly - minimize would strip the
     teaching obstacle (e.g. the pillow the bunny hops over) */
  if (n > 3 && !FIXED_LEVELS[n]) def = minimize(def);
  if (!replayWins(def)) throw new Error('level ' + n + ': sol does not win after minimize');
  if (n > 3 && def.par < 4) throw new Error('level ' + n + ': par < 4');
  if (n > 3 && def.par > ramp(n).parMax) throw new Error('level ' + n + ': par > parMax');
  if (n > 3 && !trapFree(def)) throw new Error('level ' + n + ': dead state within 2 swipes');
  const onHeart = def.dots.some((d: XY) => d[0] === def.target[0] && d[1] === def.target[1]);
  if (onHeart) throw new Error('level ' + n + ': squishy spawned on the heart');
  levels.push(def);
  console.log(
    'L' + String(n).padStart(2, '0'),
    def.w + 'x' + def.h,
    'par=' + def.par,
    'sol=' + def.sol,
    (Date.now() - s) + 'ms'
  );
}
writeFileSync('src/levels.json', JSON.stringify(levels));
console.log('wrote src/levels.json —', levels.length, 'levels in', Date.now() - t0, 'ms');
