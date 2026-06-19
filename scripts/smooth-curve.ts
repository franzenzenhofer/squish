/* Curve smoothing: walk the ladder 1..200 left to right and never let a level
   spike more than MAX_STEP moves above its RECENT neighbours (the max of the
   previous 3 levels, already smoothed). Any level that jumps higher is flattened
   down to that ceiling by removing detour walls (oracle-safe). The result is a
   smoothly rising ramp with no "this is suddenly brutal" walls. Capping against
   recent neighbours (not the global max) catches a spike that lands right after
   an easy stretch, and the max-of-3 shrugs off a single breather so dips don't
   drag the whole curve down.

   Only LOWERS par (wall removal can't raise it), so genuine breathers/dips stay -
   we only kill upward spikes. The early tutorials and any board too mover-heavy
   to analyze safely are left untouched. Re-run from a clean baseline. */
import { lastLevel, loadLevel, saveLevel } from './levelStore';
import { flattenToTarget } from './levelTransforms';

const MAX_STEP = 2;   // a level may sit at most this far above its recent peak
const FLOOR = 9;      // only flatten hard-zone spikes; never touch the easy ramp
const WALL_FLOOR = 2; // keep boards from going empty

const recent: number[] = []; // final pars of the levels just processed
let flattened = 0;
const last = lastLevel();
for (let n = 1; n <= last; n++) {
  let par = loadLevel(n).par ?? 0;
  const peak = recent.length ? Math.max(...recent.slice(-3)) : par;
  const cap = peak + MAX_STEP;
  if (n > 5 && par >= FLOOR && par > cap) {
    const eased = flattenToTarget(loadLevel(n), cap, WALL_FLOOR);
    if (eased) {
      saveLevel(n, eased);
      flattened++;
      console.log(`L${n} SPIKE par ${par} -> ${eased.par}  (recent peak ${peak}, cap ${cap})  [flattened ${flattened}]`);
      par = eased.par ?? par;
    } else {
      console.log(`L${n} spike par ${par} > cap ${cap} but not safely flattenable, left as-is`);
    }
  }
  recent.push(par);
}
console.log(`\nDONE: flattened ${flattened} spikes`);
