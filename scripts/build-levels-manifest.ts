/* Precompute every endless level (51..200) the deterministic generator will
   produce and ship it as a static manifest. The client then loads these levels
   instantly from a pre-solved board instead of paying the in-worker generation
   - which on pathological levels (e.g. L61) costs minutes of BFS + oracle
   analysis, terrible on a phone and the root cause of the "stuck then crash".
   This is the whole point: do that work once here, ship the answer.

   Each entry is the on-rung generateLevel(n) when the generator can bake it
   within a generous time cap; otherwise the deterministic safeBake descent (a
   slightly easier, always-exhaustible board) so the build is TOTAL and never
   hangs. Every entry carries its solved par + sol. Fingerprinted by the same
   engine/gen/levels hash the daily manifest uses, so a stale manifest is caught
   by tests/levels-manifest.test.ts.

   Generation is the slow part and embarrassingly parallel, so the orchestrator
   fans the level numbers across CPU cores as sharded child processes, each
   caching results incrementally (resumable: re-running skips done levels). Each
   on-rung bake runs in its own short-lived child so a pathological level can be
   killed at the time cap without wedging its shard.

   Usage: npm run levels:manifest [lastLevel]   (default lastLevel = 200) */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join } from 'node:path';
import type { LevelDef } from '../src/engine/types';
import { generateLevel } from '../src/gen/generate';
import { CAMPAIGN_END, ramp } from '../src/gen/ramp';
import { descendLevel, pickByPar } from '../src/lib/safeBake';
import { dailyVerifyFingerprint } from './dailyVerifyCache';
import curated from '../src/levels.json';

const FIRST = CAMPAIGN_END + 1; // 51 - endless generation starts after the campaign
const LAST = Number(process.env.LEVELS_LAST ?? process.argv[2] ?? 200);
const ON_RUNG_CAP_MS = Number(process.env.LEVELS_CAP_MS ?? 200000); // cap per non-marathon level
const outFile = join(process.cwd(), 'src', 'levels-verified.json');
const cacheDir = join(process.cwd(), '.levels-manifest-cache');
const fp = dailyVerifyFingerprint();
const POOL = (curated as LevelDef[]).slice(40); // the proven hard tail (par 10-13)

interface ShardCache { fp: string; levels: Record<string, LevelDef>; }

function loadShard(file: string): ShardCache {
  try {
    if (existsSync(file)) {
      const c = JSON.parse(readFileSync(file, 'utf8')) as ShardCache;
      if (c.fp === fp && c.levels) return c;
    }
  } catch { /* corrupt: recompute */ }
  return { fp, levels: {} };
}

/* ---- single-level worker: bake one on-rung level, print it, exit ---------- */
const oneArg = process.argv.indexOf('--one');
if (oneArg !== -1) {
  const n = Number(process.argv[oneArg + 1]);
  const def = generateLevel(n); // deterministic; throws if it truly cannot bake
  process.stdout.write(JSON.stringify(def) + '\n');
  process.exit(0);
}

/** The on-rung level in its own child, killed at the time cap. null = the
    generator timed out or gave up (caller then descends). */
function bakeOnRung(n: number): LevelDef | null {
  const r = spawnSync('npx', ['tsx', 'scripts/build-levels-manifest.ts', '--one', String(n)],
    { encoding: 'utf8', timeout: ON_RUNG_CAP_MS, maxBuffer: 16 * 1024 * 1024, env: process.env });
  if (r.status === 0 && r.stdout) {
    try { return JSON.parse(r.stdout.trim().split('\n').pop() as string) as LevelDef; }
    catch { /* fall through to descent */ }
  }
  return null;
}

/** TOTAL: on-rung if the generator can, else the deterministic descent, else
    the closest-par proven level. Always returns a solved, in-spec board.
    Marathon rungs (par >= 22) cannot bake on-rung in any sane time after the
    deterministic-movement graph blow-up, so they go straight to the descent
    (a proven, varied, slightly-easier board) instead of burning the time cap. */
function buildOne(n: number): LevelDef {
  const p = ramp(n);
  const onRung = p.parTarget >= 22 ? null : bakeOnRung(n);
  const def = onRung
    ?? descendLevel(n, p)
    ?? pickByPar(POOL, p.parTarget);
  if (!def) throw new Error('n=' + n + ': no level from any source');
  if (!def.sol || def.sol.length !== def.par) {
    throw new Error('n=' + n + ': missing/mismatched solution for par ' + def.par);
  }
  return def;
}

/* ---- shard worker: compute levels where (n - FIRST) % shards === i --------- */
const shardArg = process.argv.indexOf('--shard');
if (shardArg !== -1) {
  const [i, shards] = (process.argv[shardArg + 1] as string).split('/').map(Number) as [number, number];
  const file = join(cacheDir, 'shard-' + i + '.json');
  const cache = loadShard(file);
  for (let n = FIRST + i; n <= LAST; n += shards) {
    if (cache.levels[n]) continue;
    const t = Date.now();
    cache.levels[n] = buildOne(n);
    writeFileSync(file, JSON.stringify(cache));
    process.stdout.write('shard' + i + ' n' + n + ' par' + cache.levels[n]?.par +
      ' ' + Math.round((Date.now() - t) / 1000) + 's\n');
  }
  process.exit(0);
}

/* ---- orchestrator: fan shards across cores, then merge -------------------- */
const count = LAST - FIRST + 1;
const shards = Math.max(1, Math.min(count, cpus().length - 1));
mkdirSync(cacheDir, { recursive: true });
console.log('building levels', FIRST, '..', LAST, 'across', shards, 'shards, fp', fp);
const t0 = Date.now();

const runShard = (i: number): Promise<void> => new Promise((resolve, reject) => {
  const child = spawn('npx', ['tsx', 'scripts/build-levels-manifest.ts', String(LAST), '--shard', i + '/' + shards],
    { stdio: ['ignore', 'inherit', 'inherit'], env: process.env });
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('shard ' + i + ' exit ' + code)));
});

await Promise.all(Array.from({ length: shards }, (_, i) => runShard(i)));

const levels: Record<string, LevelDef> = {};
for (let i = 0; i < shards; i++) {
  const c = loadShard(join(cacheDir, 'shard-' + i + '.json'));
  for (const [n, def] of Object.entries(c.levels)) levels[n] = def;
}
const have = Object.keys(levels).length;
if (have !== count) throw new Error('merged ' + have + ' levels, expected ' + count);

const manifest = { v: 1, fp, generatedAt: new Date().toISOString(), levels };
writeFileSync(outFile, JSON.stringify(manifest) + '\n');
console.log('\nwrote', have, 'levels to', outFile, 'in', Math.round((Date.now() - t0) / 1000) + 's');
