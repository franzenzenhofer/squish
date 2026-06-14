/* Disk-memoised solver/oracle verification for the test suite.

   The engine is deterministic, so a given level's solver verdict and oracle
   contract are computed ONCE and saved to .solver-cache.json; later runs reuse
   the saved result instead of re-running the expensive BFS/oracle over every
   level. Cache keys mix:
     - a fingerprint of ALL src/engine/*.ts source (any engine change auto-
       invalidates the whole cache), and
     - the full level def (a changed level recomputes just that entry).
   So the cache is always safe: it can only return a result that was actually
   verified for the exact engine + level in the tree right now. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeLevel } from '../src/engine/core';
import { solve } from '../src/engine/solve';
import { analyzeLevel } from '../src/engine/analyze';
import type { LevelDef, SolveOptions } from '../src/engine/types';

/* fingerprint the engine source so any edit to it invalidates every entry */
const ENGINE_DIR = fileURLToPath(new URL('../src/engine/', import.meta.url));
const ENGINE_FP = (() => {
  const h = createHash('sha1');
  for (const f of readdirSync(ENGINE_DIR).sort()) {
    if (f.endsWith('.ts')) h.update(readFileSync(new URL('../src/engine/' + f, import.meta.url)));
  }
  return h.digest('hex').slice(0, 12);
})();

const CACHE_FILE = fileURLToPath(new URL('./.solver-cache.json', import.meta.url));

export interface SolveVerdict { status: 'solved' | 'unsolvable' | 'unknown'; par: number | null; }
interface CacheShape {
  fp: string;
  solve: Record<string, SolveVerdict>;
  exhausts: Record<string, boolean>;
  passed: Record<string, true>;
}

function load(): CacheShape {
  try {
    if (existsSync(CACHE_FILE)) {
      const c = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as CacheShape;
      /* same engine fingerprint → reuse; parallel workers can race the file, so
         a partial/corrupt read just falls through to a fresh cache (never a
         crash, and a missed entry only means that one verdict recomputes) */
      if (c.fp === ENGINE_FP && c.solve && c.exhausts && c.passed) return c;
    }
  } catch {
    /* unreadable/half-written cache — recompute from scratch */
  }
  return { fp: ENGINE_FP, solve: {}, exhausts: {}, passed: {} };
}

const cache = load();
const persist = (): void => writeFileSync(CACHE_FILE, JSON.stringify(cache));
const keyOf = (def: LevelDef, extra = ''): string =>
  createHash('sha1').update(extra + '|' + JSON.stringify(def)).digest('hex');

/** solve() a level from its initial state, memoised per (def, opts). */
export function cachedSolve(def: LevelDef, opts?: SolveOptions): SolveVerdict {
  const key = keyOf(def, 'solve' + JSON.stringify(opts ?? {}));
  const hit = cache.solve[key];
  if (hit) return hit;
  const res = solve(makeLevel(def), opts);
  const verdict: SolveVerdict = res.status === 'solved'
    ? { status: 'solved', par: res.par }
    : { status: res.status, par: null };
  cache.solve[key] = verdict;
  persist();
  return verdict;
}

/** Whether the full oracle exhausts (analyzeLevel), memoised per def. */
export function cachedExhausts(def: LevelDef): boolean {
  const key = keyOf(def, 'exhausts');
  const hit = cache.exhausts[key];
  if (hit !== undefined) return hit;
  const out = analyzeLevel(makeLevel(def)).exhausted;
  cache.exhausts[key] = out;
  persist();
  return out;
}

/** Run an expensive per-level verification ONCE per (engine, def, tag). On a
    later run with the same engine + level it is skipped (already proven). The
    body must throw on failure (a passing body is required to record the pass),
    so failures are never cached. */
export function oncePerLevel(def: LevelDef, tag: string, body: () => void): void {
  const key = keyOf(def, 'pass:' + tag);
  if (cache.passed[key]) return;
  body();
  cache.passed[key] = true;
  persist();
}
