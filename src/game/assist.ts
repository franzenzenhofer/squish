/* Assist — the worker client. Runs every solver/generator request off the
   main thread: endless level generation (with prefetch), the after-move
   solvability check (oh-no), and on-demand hints. Stale responses are
   dropped by token. */
import { ser } from '../engine/core';
import type { Dir, LevelDef } from '../engine/types';
import type { WorkerRequest, WorkerResponse } from '../workers/gen.worker';
import { CURATED, cacheGenLevel, cachedGenLevel, type Session } from './session';

export interface Assist {
  /** resolve level def for 0-based index (curated or generated) */
  getLevel: (li: number) => Promise<LevelDef>;
  prefetch: (li: number) => void;
  /** post-move check; callbacks fire only if the state is still current */
  checkState: (s: Session, onUnsolvable: () => void, onSolution: (sol: Dir[]) => void) => void;
  /** big-budget hint request */
  requestHint: (s: Session, onDone: (sol: Dir[] | null) => void) => void;
}

export function createAssist(): Assist {
  const worker = new Worker(new URL('../workers/gen.worker.ts', import.meta.url), {
    type: 'module'
  });
  let nextId = 1;
  const genWaiters = new Map<number, (def: LevelDef) => void>();
  const genPending = new Set<number>();
  let stateWaiter: {
    id: number;
    stateKey: string;
    s: Session;
    onUnsolvable: () => void;
    onSolution: (sol: Dir[]) => void;
  } | null = null;
  let hintWaiter: { id: number; s: Session; onDone: (sol: Dir[] | null) => void } | null = null;

  worker.onmessage = (ev: MessageEvent<WorkerResponse>): void => {
    const msg = ev.data;
    if (msg.type === 'gen') {
      cacheGenLevel(msg.n, msg.def);
      genPending.delete(msg.n);
      const w = genWaiters.get(msg.n);
      if (w) {
        genWaiters.delete(msg.n);
        w(msg.def);
      }
      return;
    }
    if (msg.type === 'solvable') {
      if (!stateWaiter || stateWaiter.id !== msg.id) return;
      const w = stateWaiter;
      stateWaiter = null;
      if (ser(w.s.gs) !== w.stateKey) return; // player already moved on
      if (msg.status === 'unsolvable') w.onUnsolvable();
      else if (msg.status === 'solved' && msg.solution) w.onSolution(msg.solution as Dir[]);
      return;
    }
    if (msg.type === 'hint') {
      if (!hintWaiter || hintWaiter.id !== msg.id) return;
      const w = hintWaiter;
      hintWaiter = null;
      w.onDone(msg.status === 'solved' && msg.solution ? (msg.solution as Dir[]) : null);
    }
  };

  const requestGen = (n: number): void => {
    if (genPending.has(n) || cachedGenLevel(n)) return;
    genPending.add(n);
    const req: WorkerRequest = { type: 'gen', id: nextId++, n };
    worker.postMessage(req);
  };

  return {
    getLevel: (li: number): Promise<LevelDef> => {
      if (li < CURATED.length) return Promise.resolve(CURATED[li] as LevelDef);
      const n = li + 1;
      const cached = cachedGenLevel(n);
      if (cached) return Promise.resolve(cached);
      requestGen(n);
      return new Promise((resolve) => genWaiters.set(n, resolve));
    },
    prefetch: (li: number): void => {
      if (li >= CURATED.length && !cachedGenLevel(li + 1)) requestGen(li + 1);
    },
    checkState: (s, onUnsolvable, onSolution): void => {
      const stateKey = ser(s.gs);
      const id = nextId++;
      stateWaiter = { id, stateKey, s, onUnsolvable, onSolution };
      const req: WorkerRequest = {
        type: 'solvable', id, def: s.def, state: structuredClone(s.gs), par: s.def.par
      };
      worker.postMessage(req);
    },
    requestHint: (s, onDone): void => {
      const id = nextId++;
      hintWaiter = { id, s, onDone };
      const req: WorkerRequest = {
        type: 'hint', id, def: s.def, state: structuredClone(s.gs), par: s.def.par
      };
      worker.postMessage(req);
    }
  };
}
