/* Assist — the worker client. Sources level defs (curated or generated, with
   localStorage cache + prefetch) and fetches each level's oracle: the full
   solved state graph. Post-move checks and hints then become synchronous
   main-thread lookups — no staleness, no races, no 'unknown'. */
import { unpackOracle, type Oracle } from '../engine/analyze';
import type { GameState, LevelDef } from '../engine/types';
import { ramp } from '../gen/ramp';
import { pickByPar } from '../lib/safeBake';
import type { WorkerRequest, WorkerResponse } from '../workers/gen.worker';
import { precomputedDaily } from './dailyManifest';
import { loadLevelsManifest, precomputedLevel } from './levelsManifest';
import { CURATED, cacheGenLevel, cachedGenLevel } from './session';

/* A live bake (level 201+, off the prebaked manifest) must NEVER make the
   player wait more than this. If the worker has not answered in time, the
   player gets a proven level at the same difficulty and keeps playing; the
   worker finishes its real bake in the background and caches it for next time.
   This is the hard guarantee behind "no stuck, no crash, no ages-long bake". */
const LIVE_BAKE_MS = 10000;

export type DeepSolveResult =
  | { status: 'solved'; solution: string[] }
  | { status: 'unsolvable' | 'unknown' };

export interface Assist {
  /** resolve level def for 0-based index (curated or generated) */
  getLevel: (li: number) => Promise<LevelDef>;
  /** the deterministic daily puzzle for a YYYY-MM-DD date */
  getDaily: (date: string) => Promise<LevelDef>;
  /** debug baker: one fresh level at hardness 1..10 (null = bake failed) */
  bake: (hardness: number, seed: number) => Promise<LevelDef | null>;
  /** warm the next level's def AND its oracle */
  prefetch: (li: number) => void;
  /** full level analysis, cached per key ('lvl:<li>' / 'daily:<date>') */
  getOracle: (cacheKey: string, def: LevelDef) => Promise<Oracle>;
  /** defense-in-depth fallback for states missing from a partial oracle */
  deepSolve: (def: LevelDef, state: GameState) => Promise<DeepSolveResult>;
}

/* v3: the deterministic-movement rework changes how every level solves, so
   dailies cached under v2 are stale — bump to force a clean regenerate. */
const DAILY_KEY = 'squish-daily-v3:';

function cachedDaily(date: string): LevelDef | null {
  try {
    const raw = localStorage.getItem(DAILY_KEY + date);
    if (raw) return JSON.parse(raw) as LevelDef;
  } catch {
    /* regenerate */
  }
  return null;
}

function cacheDaily(date: string, def: LevelDef): void {
  try {
    /* keep only today's — old dailies are dead weight */
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DAILY_KEY) && k !== DAILY_KEY + date) localStorage.removeItem(k);
    }
    localStorage.setItem(DAILY_KEY + date, JSON.stringify(def));
  } catch {
    /* cache is an optimization only */
  }
}

const ORACLE_CACHE_MAX = 3;

export function createAssist(): Assist {
  /* the oracle worker stays free for analyze/solve (fast O(1) lookups the game
     needs every move) — it is NEVER given the slow, possibly-minutes work */
  const worker = new Worker(new URL('../workers/gen.worker.ts', import.meta.url), {
    type: 'module'
  });
  /* the heavy worker owns everything slow: endless level generation, daily
     generation and debug bakes. Isolating it means a slow bake can never block
     the oracle the fallback level needs. */
  const heavyWorker = new Worker(new URL('../workers/gen.worker.ts', import.meta.url), {
    type: 'module'
  });
  let nextId = 1;
  const genWaiters = new Map<number, Array<(def: LevelDef) => void>>();
  const genPending = new Set<number>();
  const genTimers = new Map<number, number>();
  const dailyWaiters = new Map<number, (def: LevelDef) => void>();
  const bakeWaiters = new Map<number, (def: LevelDef | null) => void>();
  const analyzeWaiters = new Map<number, (o: Oracle) => void>();
  const solveWaiters = new Map<number, (r: DeepSolveResult) => void>();
  const oracles = new Map<string, Promise<Oracle>>();

  /* preloaded snapshot of the prebaked endless levels (51..200), used as the
     proven same-difficulty pool when a live bake (201+) overruns the deadline */
  let manifestLevels: Record<number, LevelDef> = {};
  void loadLevelsManifest().then((m) => { manifestLevels = m; });

  /** A proven level at the same difficulty as level n - the closest-par
      prebaked board, or the hardest curated level if the manifest has not
      loaded. Never null: this is the guarantee the player always gets a board. */
  const liveFallback = (n: number): LevelDef => {
    const target = ramp(n).parTarget;
    const pool = Object.values(manifestLevels);
    const pick = (pool.length ? pickByPar(pool, target) : pickByPar(CURATED, target))
      ?? CURATED[CURATED.length - 1];
    console.error('[squishy] live bake fallback for n=' + n + ' -> par ' + pick?.par);
    return pick as LevelDef;
  };

  const dailyFallback = (date: string): LevelDef => {
    console.error('[squishy] daily generation failed for ' + date + ' - using campaign fallback');
    return CURATED[0] as LevelDef;
  };

  /** Hand a baked def to every waiter for n and clear its pending state. */
  const settleGen = (n: number, def: LevelDef): void => {
    const ws = genWaiters.get(n) ?? [];
    genWaiters.delete(n);
    for (const w of ws) w(def);
  };

  heavyWorker.onmessage = (ev: MessageEvent<WorkerResponse>): void => {
    const msg = ev.data;
    if (msg.type === 'gen') {
      const timer = genTimers.get(msg.n);
      if (timer !== undefined) { clearTimeout(timer); genTimers.delete(msg.n); }
      genPending.delete(msg.n);
      /* cache only a REAL bake - never the fallback, so a later visit replays
         the true deterministic level. If the watchdog already answered, there
         are no waiters left; this just warms the cache. */
      if (msg.def) cacheGenLevel(msg.n, msg.def);
      settleGen(msg.n, msg.def ?? liveFallback(msg.n));
      return;
    }
    if (msg.type === 'bake') {
      const w = bakeWaiters.get(msg.id);
      bakeWaiters.delete(msg.id);
      if (w) w(msg.def);
      return;
    }
    if (msg.type !== 'daily') return;
    if (msg.def) cacheDaily(msg.date, msg.def);
    const w = dailyWaiters.get(msg.id);
    dailyWaiters.delete(msg.id);
    if (w) w(msg.def ?? dailyFallback(msg.date));
  };

  worker.onmessage = (ev: MessageEvent<WorkerResponse>): void => {
    const msg = ev.data;
    if (msg.type === 'analyze') {
      const w = analyzeWaiters.get(msg.id);
      analyzeWaiters.delete(msg.id);
      if (w) w(unpackOracle(msg.oracle));
      return;
    }
    if (msg.type !== 'solve') return;
    const w = solveWaiters.get(msg.id);
    solveWaiters.delete(msg.id);
    if (w) {
      w(msg.status === 'solved' && msg.solution
        ? { status: 'solved', solution: msg.solution }
        : { status: msg.status === 'unsolvable' ? 'unsolvable' : 'unknown' });
    }
  };

  /* Post a live bake to the heavy worker and arm the watchdog (once per n). */
  const startLiveBake = (n: number): void => {
    if (genPending.has(n)) return;
    genPending.add(n);
    const req: WorkerRequest = { type: 'gen', id: nextId++, n };
    heavyWorker.postMessage(req);
    const timer = window.setTimeout(() => {
      genTimers.delete(n);
      if (!genPending.has(n)) return; // worker already answered
      /* keep genPending set so the worker's eventual real bake still caches and
         does not get re-posted; the player gets the proven fallback now */
      settleGen(n, liveFallback(n));
    }, LIVE_BAKE_MS);
    genTimers.set(n, timer);
  };

  const requestGen = (n: number): Promise<LevelDef> => {
    const cached = cachedGenLevel(n);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve) => {
      void precomputedLevel(n).then((pre) => {
        /* prebaked endless level (51..200): instant, deterministic, no worker */
        if (pre) { cacheGenLevel(n, pre); resolve(pre); return; }
        const ws = genWaiters.get(n) ?? [];
        ws.push(resolve);
        genWaiters.set(n, ws);
        startLiveBake(n);
      });
    });
  };

  const getLevel = (li: number): Promise<LevelDef> => {
    if (li < CURATED.length) return Promise.resolve(CURATED[li] as LevelDef);
    return requestGen(li + 1);
  };

  const getOracle = (cacheKey: string, def: LevelDef): Promise<Oracle> => {
    const hit = oracles.get(cacheKey);
    if (hit) return hit;
    const p = new Promise<Oracle>((resolve) => {
      const id = nextId++;
      analyzeWaiters.set(id, resolve);
      const req: WorkerRequest = { type: 'analyze', id, def };
      worker.postMessage(req);
    });
    oracles.set(cacheKey, p);
    while (oracles.size > ORACLE_CACHE_MAX) {
      const oldest = oracles.keys().next().value as string;
      oracles.delete(oldest);
    }
    return p;
  };

  return {
    getLevel,
    getOracle,
    /* bakes ride the heavy worker so the oracle worker stays free */
    bake: (hardness: number, seed: number): Promise<LevelDef | null> =>
      new Promise((resolve) => {
        const id = nextId++;
        bakeWaiters.set(id, resolve);
        const req: WorkerRequest = { type: 'bake', id, hardness, seed };
        heavyWorker.postMessage(req);
      }),
    getDaily: async (date: string): Promise<LevelDef> => {
      const cached = cachedDaily(date);
      if (cached) return cached;
      /* shipped pre-solved daily: skips the slow in-worker generation + solve */
      const pre = await precomputedDaily(date);
      if (pre) {
        cacheDaily(date, pre);
        return pre;
      }
      return new Promise((resolve) => {
        const id = nextId++;
        dailyWaiters.set(id, resolve);
        const req: WorkerRequest = { type: 'daily', id, date };
        heavyWorker.postMessage(req);
      });
    },
    prefetch: (li: number): void => {
      void getLevel(li).then((def) => {
        void getOracle('lvl:' + li, def);
      });
    },
    deepSolve: (def: LevelDef, state: GameState): Promise<DeepSolveResult> =>
      new Promise((resolve) => {
        const id = nextId++;
        solveWaiters.set(id, resolve);
        const req: WorkerRequest = {
          type: 'solve', id, def, state: structuredClone(state)
        };
        worker.postMessage(req);
      })
  };
}
