/* Prove the daily generator never fails and always meets its hard constraints:
   366 consecutive dates, each must produce a level with par 7..10 whose full
   oracle exhausts and whose initial state is solved at exactly that par.
   Successful date proofs are cached by engine/generator fingerprint, so reruns
   skip already-proven dates.
   Usage: npm run daily:verify [days]
          npm run daily:verify -- --date YYYY-MM-DD */
import { join } from 'node:path';
import { analyzeLevel, solutionFrom } from '../src/engine/analyze';
import { DIRCODE, makeLevel, ser } from '../src/engine/core';
import { generateDaily } from '../src/gen/daily';
import {
  dailyVerifyFingerprint,
  hashDailyDef,
  loadDailyVerifyCache,
  saveDailyVerifyCache,
  type DailyVerifyEntry
} from './dailyVerifyCache';

const args = process.argv.slice(2);
const dateArg = args[0] === '--date' ? args[1] : undefined;
const days = dateArg ? 1 : Number(args[0] ?? 366);
const start = Date.UTC(2026, 0, 1);
const cacheFile = join(process.cwd(), '.daily-verify-cache.json');
const fp = dailyVerifyFingerprint();
const cache = loadDailyVerifyCache(cacheFile, fp);
const pars: Record<number, number> = {};
let maxMs = 0;
let cached = 0;
const t0 = Date.now();
for (let i = 0; i < days; i++) {
  const date = dateArg ?? dateAt(start, i);
  const s = Date.now();
  const cachedEntry = cache.days[date];
  const hit = cachedEntry !== undefined;
  if (!hit) console.log(date, 'checking...');
  const entry = cachedEntry ?? verifyDate(date);
  if (hit) {
    cached++;
  } else {
    cache.days[date] = entry;
    saveDailyVerifyCache(cacheFile, cache);
  }
  const ms = Date.now() - s;
  maxMs = Math.max(maxMs, ms);
  pars[entry.par] = (pars[entry.par] ?? 0) + 1;
  if (dateArg || !hit || i % 30 === 0) {
    console.log(date, 'par', entry.par, entry.width + 'x' + entry.height,
      entry.states + ' states', 'sol', entry.solution, hit ? 'cached' : ms + 'ms');
  }
}
console.log('\nall', days, 'dailies OK in', Math.round((Date.now() - t0) / 1000) + 's',
  '| cached:', cached, '| worst single:', maxMs + 'ms',
  '| par histogram:', JSON.stringify(pars));

function dateAt(startMs: number, dayOffset: number): string {
  const d = new Date(startMs + dayOffset * 86400000);
  return d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0');
}

function verifyDate(date: string): DailyVerifyEntry {
  const def = generateDaily(date);
  if (def.par < 7 || def.par > 10) throw new Error(date + ': par ' + def.par + ' out of band');
  const level = makeLevel(def);
  const oracle = analyzeLevel(level);
  if (!oracle.exhausted) throw new Error(date + ': oracle not exhausted');
  if (oracle.dist.get(ser(level.initState)) !== def.par) throw new Error(date + ': par mismatch');
  const sol = solutionFrom(level, level.initState, oracle);
  if (!sol) throw new Error(date + ': oracle produced no solution');
  return {
    date,
    par: def.par,
    states: oracle.states,
    width: def.w,
    height: def.h,
    solution: sol.map((dir) => DIRCODE[dir]).join(''),
    defHash: hashDailyDef(def),
    verifiedAt: new Date().toISOString()
  };
}
