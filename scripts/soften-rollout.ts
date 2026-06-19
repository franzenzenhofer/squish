/* Gentle curve softening across the whole 1..200 ladder. For every HARD level
   (par >= 8) whose graph is light enough to analyze safely, remove ONE detour
   wall that eases the optimal by 1..2 moves (never more), then re-solve in place.
   Levels that are already easy, can't be eased by a single wall, or are too
   mover-heavy to analyze safely are left untouched.

   Writes straight into the pinned data (levels.json / levels-verified.json) via
   the level store. Re-run only from a clean baseline (git checkout the data files
   first) - it operates on whatever board it finds, so a second run would compound.

   Usage: npx tsx scripts/soften-rollout.ts [firstN] [lastN] */
import { lastLevel, loadLevel, saveLevel } from './levelStore';
import { measure, softenByWallRemoval } from './levelTransforms';

const MAX_DROP = 2;       // honour "par may drop by up to 2"
const WALL_FLOOR = 2;     // never strip a board below 2 walls (don't feel empty)
const HARD = 8;           // only soften par >= 8

const first = Number(process.argv[2] ?? 1);
const last = Number(process.argv[3] ?? lastLevel());

let changed = 0;
let shedTotal = 0;
const t0 = Date.now();
for (let n = first; n <= last; n++) {
  const def = loadLevel(n);
  if ((def.par ?? 0) < HARD) { console.log(`L${n} par${def.par} easy, skip`); continue; }
  const base = measure(def);
  if (!base) { console.log(`L${n} par${def.par} too heavy to analyze safely, skip`); continue; }
  const { def: soft, shed } = softenByWallRemoval(def, MAX_DROP, WALL_FLOOR);
  if (shed > 0) {
    saveLevel(n, soft);
    changed++;
    shedTotal += shed;
    console.log(`L${n} par ${def.par}->${soft.par}  (-${shed}, removed 1 wall)  [changed ${changed}]`);
  } else {
    console.log(`L${n} par${def.par} no gentle wall removal, unchanged`);
  }
}
console.log(`\nDONE: softened ${changed} levels, ${shedTotal} total par shed, in ${Math.round((Date.now() - t0) / 1000)}s`);
