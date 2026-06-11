/* Build the 40 curated levels: generate, minimality-pass, caption, verify,
   write src/levels.json. Deterministic — rerunning yields identical output. */
import { writeFileSync } from 'node:fs';
import { CODEDIR, DIRCODE, cloneState, isWin, makeLevel } from '../src/engine/core';
import { move } from '../src/engine/move';
import { solve, spamSolvable } from '../src/engine/solve';
import type { Dir, DirCode, LevelDef, XY } from '../src/engine/types';
import { generateLevel, trapFree } from '../src/gen/generate';
import { ramp } from '../src/gen/ramp';

const CAPS: Record<number, string> = {
  4: 'penguin glides over thin ice without cracking it',
  5: 'bunny hops two squares - right over things',
  6: 'froggy leaps all the way to the next wall',
  7: 'bear plods two steps and scares nomsters away',
  8: 'ghostie floats straight through walls',
  9: 'collect every star to open the heart',
  10: 'bump piggy and she scoots one square',
  11: 'kitty turns right when she bumps into things',
  12: 'panda is sleepy - he moves every second swipe',
  13: 'chick copies your previous swipe',
  14: 'flowers are sticky - you stop on them',
  16: 'swirls teleport you',
  17: 'sparkles split your squishy in two',
  19: 'jelly hops you over the next tile',
  20: 'curls turn you clockwise',
  21: 'springs bounce you backwards',
  22: 'wind clouds blow you their way',
  26: 'two friends, one heart',
  40: 'the grand finale'
};

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
  if (n > 3) def = minimize(def);
  const cap = CAPS[n];
  if (cap) def.cap = cap;
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
