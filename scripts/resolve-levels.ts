/* Re-solve a JSON array of LevelDef in place against the CURRENT engine:
   the board is kept byte-for-byte, only `par`/`sol` (and `cap` if present) are
   refreshed to the new optimal line. Used after a movement-rule change so every
   shipped level stays proven solvable with an honest par. Reports anything that
   went unsolvable or became spam-solvable (mash-one-direction). */
import { readFileSync, writeFileSync } from 'node:fs';
import { DIRCODE, makeLevel } from '../src/engine/core';
import { solve, spamSolvable } from '../src/engine/solve';
import type { Dir, LevelDef } from '../src/engine/types';

const path = process.argv[2];
if (!path) throw new Error('usage: tsx scripts/resolve-levels.ts <path-to-levels.json>');
const maxDepth = Number(process.env.MAXDEPTH ?? 30);
const maxStates = Number(process.env.MAXSTATES ?? 4_000_000);

const levels = JSON.parse(readFileSync(path, 'utf8')) as LevelDef[];
const problems: string[] = [];

levels.forEach((def, i) => {
  const n = i + 1;
  const level = makeLevel(def);
  const res = solve(level, { maxStates, maxDepth });
  if (res.status !== 'solved') {
    problems.push(`L${n}: ${res.status} (board kept, par/sol NOT updated)`);
    console.log(`L${String(n).padStart(2, '0')}  ${res.status.toUpperCase()}  <-- needs a board fix`);
    return;
  }
  const oldPar = def.par;
  const newSol = res.solution.map((d: Dir) => DIRCODE[d]).join('');
  def.par = res.par;
  def.sol = newSol;
  const spam = spamSolvable(level, res.par);
  if (spam) problems.push(`L${n}: spam-solvable at par ${res.par}`);
  console.log(
    `L${String(n).padStart(2, '0')}  par ${oldPar} -> ${res.par}  sol=${newSol}` + (spam ? '  SPAM!' : '')
  );
});

writeFileSync(path, JSON.stringify(levels));
console.log(`\nwrote ${path} (${levels.length} levels). problems: ${problems.length}`);
for (const p of problems) console.log('  - ' + p);
