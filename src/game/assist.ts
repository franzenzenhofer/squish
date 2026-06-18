/* Assist — the worker client. Sources level defs (curated or generated, with
   localStorage cache + prefetch) and fetches each level's oracle: the full
   solved state graph. Post-move checks and hints then become synchronous
   main-thread lookups — no staleness, no races, no 'unknown'. */
import { unpackOracle, type Oracle } from '../engine/analyze';
import type { GameState, LevelDef } from '../engine/types';
import type { WorkerRequest, WorkerResponse } from '../workers/gen.worker';
import { precomputedDaily } from './dailyManifest';
import { CURATED, cacheGenLevel, cachedGenLevel } from './session';

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
  const worker = new Worker(new URL('../workers/gen.worker.ts', import.meta.url), {
    type: 'module'
  });
  /* daily generation can take seconds — it gets its own worker so the main
     one stays free for oracles and post-move checks */
  const dailyWorker = new Worker(new URL('../workers/gen.worker.ts', import.meta.url), {
    type: 'module'
  });
  let nextId = 1;
  const genWaiters = new Map<number, Array<(def: LevelDef) => void>>();
  const genPending = new Set<number>();
  const dailyWaiters = new Map<number, (def: LevelDef) => void>();
  const bakeWaiters = new Map<number, (def: LevelDef | null) => void>();
  const analyzeWaiters = new Map<number, (o: Oracle) => void>();
  const solveWaiters = new Map<number, (r: DeepSolveResult) => void>();
  const oracles = new Map<string, Promise<Oracle>>();

  const dailyFallback = (date: string): LevelDef => {
    console.error('[squishy] daily generation failed for ' + date + ' - using campaign fallback');
    return CURATED[0] as LevelDef;
  };

  dailyWorker.onmessage = (ev: MessageEvent<WorkerResponse>): void => {
    const msg = ev.data;
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
    if (msg.type === 'gen') {
      cacheGenLevel(msg.n, msg.def);
      genPending.delete(msg.n);
      const ws = genWaiters.get(msg.n) ?? [];
      genWaiters.delete(msg.n);
      for (const w of ws) w(msg.def);
      return;
    }
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

  const requestGen = (n: number): Promise<LevelDef> => {
    const cached = cachedGenLevel(n);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve) => {
      const ws = genWaiters.get(n) ?? [];
      ws.push(resolve);
      genWaiters.set(n, ws);
      if (!genPending.has(n)) {
        genPending.add(n);
        const req: WorkerRequest = { type: 'gen', id: nextId++, n };
        worker.postMessage(req);
      }
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
    /* bakes ride the daily worker so the main one stays free for oracles */
    bake: (hardness: number, seed: number): Promise<LevelDef | null> =>
      new Promise((resolve) => {
        const id = nextId++;
        bakeWaiters.set(id, resolve);
        const req: WorkerRequest = { type: 'bake', id, hardness, seed };
        dailyWorker.postMessage(req);
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
        dailyWorker.postMessage(req);
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
