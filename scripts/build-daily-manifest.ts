/* Precompute every daily puzzle the deterministic generator will produce and
   ship it as a static manifest. The client then loads a daily instantly from
   this pre-solved level instead of paying the in-worker generation - which on
   pathological dates costs 60-120s of BFS (terrible on a phone). This is the
   whole point: do that work once here, ship the answer.

   Each entry is exactly what generateDaily(date) yields - the same deterministic
   source the client falls back to - with the optimal line already in def.sol
   (the generator solves every board to set par, so the solution ships for free).
   Fingerprinted by the same engine/gen/levels hash the daily verifier uses, so a
   stale manifest is caught by tests/daily-manifest.test.ts.

   Generation is the slow part and embarrassingly parallel, so the orchestrator
   fans the dates across CPU cores as sharded child processes, each caching its
   results incrementally (resumable: re-running skips proven dates).

   Usage: npm run daily:manifest [days] */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import type { LevelDef } from '../src/engine/types';
import { generateDaily } from '../src/gen/daily';
import { dailyVerifyFingerprint } from './dailyVerifyCache';

const START = Date.UTC(2026, 0, 1);
const days = Number(process.env.OG_DAYS ?? process.argv[2] ?? 366);
const outFile = join(process.cwd(), 'src', 'daily-verified.json');
const cacheDir = join(process.cwd(), '.daily-manifest-cache');
const fp = dailyVerifyFingerprint();

function dateAt(dayOffset: number): string {
  const d = new Date(START + dayOffset * 86400000);
  return d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0');
}

interface ShardCache { fp: string; days: Record<string, LevelDef>; }

function loadShard(file: string): ShardCache {
  try {
    if (existsSync(file)) {
      const c = JSON.parse(readFileSync(file, 'utf8')) as ShardCache;
      if (c.fp === fp && c.days) return c;
    }
  } catch { /* corrupt: recompute */ }
  return { fp, days: {} };
}

function buildOne(date: string): LevelDef {
  const def = generateDaily(date);
  if (def.par < 7 || def.par > 10) throw new Error(date + ': par ' + def.par + ' out of band');
  if (!def.sol || def.sol.length !== def.par) {
    throw new Error(date + ': missing/mismatched solution for par ' + def.par);
  }
  return def;
}

/* ---- shard worker: compute dates where dayIndex % n === i ----------------- */
const shardArg = process.argv.indexOf('--shard');
if (shardArg !== -1) {
  const [i, n] = (process.argv[shardArg + 1] as string).split('/').map(Number) as [number, number];
  const file = join(cacheDir, 'shard-' + i + '.json');
  const cache = loadShard(file);
  for (let d = i; d < days; d += n) {
    const date = dateAt(d);
    if (cache.days[date]) continue;
    const t = Date.now();
    cache.days[date] = buildOne(date);
    writeFileSync(file, JSON.stringify(cache));
    process.stdout.write('shard' + i + ' ' + date + ' par' + cache.days[date]?.par +
      ' ' + (Date.now() - t) + 'ms\n');
  }
  process.exit(0);
}

/* ---- orchestrator: fan shards across cores, then merge -------------------- */
const n = Math.max(1, Math.min(days, cpus().length - 1));
mkdirSync(cacheDir, { recursive: true });
console.log('building', days, 'dailies across', n, 'shards, fp', fp);
const t0 = Date.now();

const runShard = (i: number): Promise<void> => new Promise((resolve, reject) => {
  const child = spawn('npx', ['tsx', 'scripts/build-daily-manifest.ts', String(days), '--shard', i + '/' + n],
    { stdio: ['ignore', 'inherit', 'inherit'], env: process.env });
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('shard ' + i + ' exit ' + code)));
});

await Promise.all(Array.from({ length: n }, (_, i) => runShard(i)));

const out: Record<string, LevelDef> = {};
for (let i = 0; i < n; i++) {
  const file = join(cacheDir, 'shard-' + i + '.json');
  const c = loadShard(file);
  for (const [date, def] of Object.entries(c.days)) out[date] = def;
}
const have = Object.keys(out).length;
if (have !== days) throw new Error('merged ' + have + ' dailies, expected ' + days);

const manifest = { v: 1, fp, generatedAt: new Date().toISOString(), days: out };
writeFileSync(outFile, JSON.stringify(manifest) + '\n');
console.log('\nwrote', have, 'dailies to', outFile, 'in', Math.round((Date.now() - t0) / 1000) + 's');
