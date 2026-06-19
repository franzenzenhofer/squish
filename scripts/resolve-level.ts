/* Single-level re-solve — the cheap, no-full-re-bake edit workflow.

   Hand-edit a board in src/levels.json (1..50) or src/levels-verified.json
   (51..200), then run `npm run level:resolve <n> [n2 ...]` to recompute that
   level's par + sol from the edited board and write it straight back. No
   generator, no manifest re-bake, no daily re-bake — one level, one re-solve.

   Verify afterwards with `npm test -- tests/levels-manifest.test.ts` (every
   shipped level still solves to its stated par). */
import { loadLevel, resolveDef, saveLevel } from './levelStore';

const nums = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n > 0);
if (nums.length === 0) {
  console.error('usage: npm run level:resolve <levelNumber> [levelNumber ...]');
  process.exit(1);
}

for (const n of nums) {
  const before = loadLevel(n);
  const after = resolveDef(before);
  saveLevel(n, after);
  const changed = before.par !== after.par || before.sol !== after.sol;
  console.log(
    'L' + n,
    'par ' + before.par + ' -> ' + after.par,
    'sol ' + (after.sol ?? ''),
    changed ? '(updated)' : '(unchanged)'
  );
}
