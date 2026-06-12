/* Web worker: endless level generation and full level analysis (the oracle)
   — all off the main thread. Stateless: every request carries what it needs.
   The deep 'solve' request is a defense-in-depth fallback for states missing
   from a non-exhausted oracle; shipped levels always analyze exhaustively. */
import { analyzeLevel, packOracle, type OracleWire } from '../engine/analyze';
import { makeLevel } from '../engine/core';
import { solve } from '../engine/solve';
import type { GameState, LevelDef } from '../engine/types';
import { generateDaily } from '../gen/daily';
import { finalize, generateLevel, tryGenerate } from '../gen/generate';
import { bakeParams } from '../gen/ramp';
import { mulberry32 } from '../gen/rng';
import curated from '../levels.json';

export type WorkerRequest =
  | { type: 'gen'; id: number; n: number }
  | { type: 'daily'; id: number; date: string }
  | { type: 'bake'; id: number; hardness: number; seed: number }
  | { type: 'analyze'; id: number; def: LevelDef }
  | { type: 'solve'; id: number; def: LevelDef; state: GameState };

export type WorkerResponse =
  | { type: 'gen'; id: number; n: number; def: LevelDef }
  | { type: 'daily'; id: number; date: string; def: LevelDef | null }
  | { type: 'bake'; id: number; def: LevelDef | null }
  | { type: 'analyze'; id: number; oracle: OracleWire }
  | { type: 'solve'; id: number; status: 'solved' | 'unsolvable' | 'unknown'; solution?: string[] };

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
  if (msg.type === 'daily') {
    try {
      const def = generateDaily(msg.date);
      scope.postMessage({ type: 'daily', id: msg.id, date: msg.date, def });
    } catch (e) {
      console.error('[squishy] daily generation failed:', e);
      scope.postMessage({ type: 'daily', id: msg.id, date: msg.date, def: null });
    }
    return;
  }
  if (msg.type === 'bake') {
    /* debug baker: one solver-verified level at the requested hardness; the
       seed varies the cast. No fallback — a failed bake reports null. */
    const rng = mulberry32(msg.seed >>> 0);
    const c = tryGenerate(rng, bakeParams(msg.hardness, msg.seed));
    scope.postMessage({ type: 'bake', id: msg.id, def: c ? finalize(c) : null });
    return;
  }
  if (msg.type === 'analyze') {
    const oracle = analyzeLevel(makeLevel(msg.def));
    if (!oracle.exhausted) {
      console.warn('[squishy] oracle not exhausted:', oracle.states, 'states');
    }
    scope.postMessage({ type: 'analyze', id: msg.id, oracle: packOracle(oracle) });
    return;
  }
  const res = solve(makeLevel(msg.def), {
    maxStates: 2000000, maxDepth: 64, deadlineMs: 5000
  }, msg.state);
  if (res.status === 'solved') {
    scope.postMessage({ type: 'solve', id: msg.id, status: 'solved', solution: res.solution });
  } else {
    scope.postMessage({ type: 'solve', id: msg.id, status: res.status });
  }
};
