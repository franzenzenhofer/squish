/* Level oracle — exhaustively explores the FULL reachable state graph of a
   level (forward BFS, no depth cap), then reverse-propagates winnability and
   distance-to-win from every win state. Result: every reachable state maps to
   its best move ('' = provably unwinnable) via an O(1) lookup. This is what
   makes "no hint right now" and silently-dead states impossible.
   Curated/generated boards measure 18–25k reachable states; the default caps
   give >10x headroom and generation rejects anything not fully exhaustible. */
import { DIRNAMES, cloneState, isWin, ser } from './core';
import { move } from './move';
import type { Dir, GameState, Level } from './types';

export interface Oracle {
  /** true = the whole reachable graph was explored; '' labels are proofs.
      false = caps tripped; only positive (dir) labels are trustworthy. */
  exhausted: boolean;
  states: number;
  /** ser(state) -> best direction toward the win, '' = unwinnable */
  policy: Map<string, Dir | ''>;
  /** ser(state) -> optimal moves-to-win (winnable states only) */
  dist: Map<string, number>;
}

export interface AnalyzeOptions {
  maxStates?: number;
  deadlineMs?: number;
}

interface Node {
  st: GameState;
  edges: Array<{ dir: Dir; to: number }>;
  win: boolean;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function analyzeLevel(level: Level, opts?: AnalyzeOptions): Oracle {
  const maxStates = opts?.maxStates ?? 300000;
  /* generous: slow phones must still exhaust a ~300k-state daily graph */
  const deadlineMs = opts?.deadlineMs ?? 45000;
  const t0 = nowMs();

  const idx = new Map<string, number>();
  const nodes: Node[] = [];
  const keys: string[] = [];
  const addNode = (st: GameState, k: string): number => {
    const i = nodes.length;
    idx.set(k, i);
    keys.push(k);
    nodes.push({ st, edges: [], win: isWin(level, st) });
    return i;
  };

  const startKey = ser(level.initState);
  addNode(cloneState(level.initState), startKey);
  let exhausted = true;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i] as Node;
    if (node.win) continue; // terminal — no need to play past the heart
    if ((i & 255) === 0 && nowMs() - t0 > deadlineMs) {
      exhausted = false;
      break;
    }
    for (const dir of DIRNAMES) {
      const r = move(level, node.st, dir);
      if (!r.moved) continue;
      if (r.state.dots.length === 0) continue; // dead leaf: dots never respawn
      const k = ser(r.state);
      let to = idx.get(k);
      if (to === undefined) {
        if (nodes.length >= maxStates) {
          exhausted = false;
          continue;
        }
        to = addNode(r.state, k);
      }
      node.edges.push({ dir, to });
    }
  }

  /* reverse BFS from all win states */
  const radj: number[][] = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    for (const e of (nodes[i] as Node).edges) (radj[e.to] as number[]).push(i);
  }
  const distArr = new Int32Array(nodes.length).fill(-1);
  let frontier: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if ((nodes[i] as Node).win) {
      distArr[i] = 0;
      frontier.push(i);
    }
  }
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const i of frontier) {
      const d = (distArr[i] as number) + 1;
      for (const p of radj[i] as number[]) {
        if (distArr[p] === -1) {
          distArr[p] = d;
          next.push(p);
        }
      }
    }
    frontier = next;
  }

  const policy = new Map<string, Dir | ''>();
  const dist = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) {
    const k = keys[i] as string;
    const d = distArr[i] as number;
    if (d === -1) {
      policy.set(k, '');
      continue;
    }
    dist.set(k, d);
    if (d === 0) {
      policy.set(k, '');
      continue;
    }
    const best = (nodes[i] as Node).edges.find((e) => distArr[e.to] === d - 1);
    policy.set(k, best ? best.dir : '');
  }
  return { exhausted, states: nodes.length, policy, dist };
}

/** true = winnable, false = provably dead, null = cannot judge.
    "Provably dead" requires an EXHAUSTED oracle: in a truncated graph (state or
    deadline budget hit) a state with no winning path may simply lead through
    unexplored territory - reporting false there made the oh-no rewind perfectly
    winnable moves. Truncated graphs only ever answer true or null. */
export function winnableState(oracle: Oracle, stateKey: string): boolean | null {
  if (oracle.dist.has(stateKey)) return true;
  if (oracle.exhausted && oracle.policy.has(stateKey)) return false;
  return null;
}

/** Replay the oracle's policy from a state into a full solution line. */
export function solutionFrom(level: Level, gs: GameState, oracle: Oracle): Dir[] | null {
  let st = cloneState(gs);
  const line: Dir[] = [];
  for (let i = 0; i <= oracle.states; i++) {
    if (isWin(level, st)) return line;
    const dir = oracle.policy.get(ser(st));
    if (dir === undefined || dir === '') return null;
    const r = move(level, st, dir);
    if (!r.moved) return null;
    st = r.state;
    line.push(dir);
  }
  return null;
}

/** Flatten an oracle for structured-clone transfer out of the worker. */
export interface OracleWire {
  exhausted: boolean;
  states: number;
  policy: Array<[string, Dir | '']>;
  dist: Array<[string, number]>;
}

export function packOracle(o: Oracle): OracleWire {
  return {
    exhausted: o.exhausted, states: o.states,
    policy: Array.from(o.policy.entries()), dist: Array.from(o.dist.entries())
  };
}

export function unpackOracle(w: OracleWire): Oracle {
  return {
    exhausted: w.exhausted, states: w.states,
    policy: new Map(w.policy), dist: new Map(w.dist)
  };
}
