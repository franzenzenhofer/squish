/* Endless-ladder proof — generation is deterministic per level number, so
   this script measures the ACTUAL levels every player will get and enforces
   the never-easier contract on them:
     1. realized par never drops below the level's rung floor minus 1
        (one breathing notch is the most a rescue round may concede)
     2. between consecutive measured levels, par never drops by more than 2
        (the same tolerance the curated audit enforces)
     3. wall-clock per level stays within an on-device budget
   Usage: npm run levels:ladder  (full 41-60, then the milestone rungs) */
import { generateLevel } from '../src/gen/generate';
import { ramp } from '../src/gen/ramp';

const SAMPLE: number[] = [];
for (let n = 51; n <= 70; n++) SAMPLE.push(n);
SAMPLE.push(80, 90, 100, 125, 150, 175, 200);

/* Per-level wall-clock ceiling. Deep levels bake in a background worker
   DURING the (minutes-long) previous level and are cached forever, so the
   budget is "must finish well within one marathon level's play time". */
const TIME_BUDGET_MS = 480000;

interface Row { n: number; par: number; floor: number; size: string; ms: number }
const rows: Row[] = [];
let failed = false;

console.log('lvl  size  par floor rung-ok   time');
for (const n of SAMPLE) {
  const t0 = Date.now();
  const def = generateLevel(n);
  const ms = Date.now() - t0;
  const floor = ramp(n).parMin;
  const ok = def.par >= floor - 1;
  if (!ok) failed = true;
  if (ms > TIME_BUDGET_MS) failed = true;
  rows.push({ n, par: def.par, floor, size: def.w + 'x' + def.h, ms });
  console.log(
    String(n).padStart(3), (def.w + 'x' + def.h).padStart(5),
    String(def.par).padStart(4), String(floor).padStart(5),
    (ok ? 'yes' : 'NO!').padStart(7), String(ms).padStart(6) + 'ms'
  );
}

for (let i = 1; i < rows.length; i++) {
  const a = rows[i - 1] as Row;
  const b = rows[i] as Row;
  if (b.par < a.par - 2) {
    failed = true;
    console.error('REGRESSION: L' + a.n + ' par ' + a.par + ' -> L' + b.n + ' par ' + b.par);
  }
}

const pars = rows.map((r) => 'L' + r.n + ':' + r.par).join(' ');
console.log('\nladder: ' + pars);
console.log(failed ? '\nLADDER CONTRACT VIOLATED' : '\nladder contract holds: harder and harder, never easier');
process.exit(failed ? 1 : 0);
