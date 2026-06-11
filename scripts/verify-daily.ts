/* Prove the daily generator never fails and always meets its hard
   constraints: 365 consecutive dates, each must produce a level with
   par 7..10 whose optimal line uses 3 friend types + 2 field types.
   Usage: npm run daily:verify [days] */
import { analyzeLevel } from '../src/engine/analyze';
import { makeLevel, ser } from '../src/engine/core';
import { generateDaily } from '../src/gen/daily';

const days = Number(process.argv[2] ?? 365);
const start = Date.UTC(2026, 0, 1);
const pars: Record<number, number> = {};
let maxMs = 0;
const t0 = Date.now();
for (let i = 0; i < days; i++) {
  const d = new Date(start + i * 86400000);
  const date = d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0');
  const s = Date.now();
  const def = generateDaily(date);
  const ms = Date.now() - s;
  maxMs = Math.max(maxMs, ms);
  if (def.par < 7 || def.par > 10) throw new Error(date + ': par ' + def.par + ' out of band');
  const level = makeLevel(def);
  const oracle = analyzeLevel(level);
  if (!oracle.exhausted) throw new Error(date + ': oracle not exhausted');
  if (oracle.dist.get(ser(level.initState)) !== def.par) throw new Error(date + ': par mismatch');
  pars[def.par] = (pars[def.par] ?? 0) + 1;
  if (i % 30 === 0) console.log(date, 'par', def.par, def.w + 'x' + def.h, ms + 'ms');
}
console.log('\nall', days, 'dailies OK in', Math.round((Date.now() - t0) / 1000) + 's',
  '| worst single:', maxMs + 'ms', '| par histogram:', JSON.stringify(pars));
