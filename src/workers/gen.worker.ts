/* Web worker: endless level generation, solvability checks ("oh no") and
   hints — all off the main thread. Stateless: every request carries the
   level definition and (for solver requests) the current game state. */
import { makeLevel } from '../engine/core';
import { solve } from '../engine/solve';
import type { GameState, LevelDef } from '../engine/types';
import { generateLevel } from '../gen/generate';
import curated from '../levels.json';

export type WorkerRequest =
  | { type: 'gen'; id: number; n: number }
  | { type: 'solvable'; id: number; def: LevelDef; state: GameState; par: number }
  | { type: 'hint'; id: number; def: LevelDef; state: GameState; par: number };

export type WorkerResponse =
  | { type: 'gen'; id: number; n: number; def: LevelDef }
  | { type: 'solvable'; id: number; status: 'solved' | 'unsolvable' | 'unknown'; solution?: string[] }
  | { type: 'hint'; id: number; status: string; solution?: string[] };

const FALLBACK = (curated as LevelDef[]).slice(28);

const scope = self as unknown as {
  postMessage: (msg: WorkerResponse) => void;
  onmessage: ((ev: MessageEvent<WorkerRequest>) => void) | null;
};

scope.onmessage = (ev: MessageEvent<WorkerRequest>): void => {
  const msg = ev.data;
  if (msg.type === 'gen') {
    const def = generateLevel(msg.n, FALLBACK);
    scope.postMessage({ type: 'gen', id: msg.id, n: msg.n, def });
    return;
  }
  const level = makeLevel(msg.def);
  if (msg.type === 'solvable') {
    const res = solve(level, {
      maxStates: 30000,
      maxDepth: Math.min(14, msg.par + 6),
      deadlineMs: 300
    }, msg.state);
    if (res.status === 'solved') {
      scope.postMessage({ type: 'solvable', id: msg.id, status: 'solved', solution: res.solution });
    } else {
      scope.postMessage({ type: 'solvable', id: msg.id, status: res.status });
    }
    return;
  }
  const res = solve(level, {
    maxStates: 120000,
    maxDepth: Math.min(15, msg.par + 7),
    deadlineMs: 800
  }, msg.state);
  if (res.status === 'solved') {
    scope.postMessage({ type: 'hint', id: msg.id, status: 'solved', solution: res.solution });
  } else {
    scope.postMessage({ type: 'hint', id: msg.id, status: res.status });
  }
};
