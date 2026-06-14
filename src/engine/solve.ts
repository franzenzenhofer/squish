/* BFS solver over full game states (tri-state), spam check, feature replay.
   'unsolvable' is only reported when the reachable space was EXHAUSTED within
   budget — any budget hit yields 'unknown' so the UI never false-alarms. */
import { DIRNAMES, cloneState, isWin, key, ser } from './core';
import { move } from './move';
import type {
  Dir, GameState, Level, SolveOptions, SolveResult
} from './types';

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function solve(level: Level, opts?: SolveOptions, from?: GameState): SolveResult {
  const maxStates = opts?.maxStates ?? 800000;
  const maxDepth = opts?.maxDepth ?? 16;
  const deadlineMs = opts?.deadlineMs;
  const t0 = nowMs();
  const start = cloneState(from ?? level.initState);
  if (isWin(level, start)) return { status: 'solved', par: 0, ways: 1, solution: [] };
  const startKey = ser(start);
  const dist = new Map<string, number>([[startKey, 0]]);
  const ways = new Map<string, number>([[startKey, 1]]);
  const parent = new Map<string, { prev: string; dir: Dir }>();
  let frontier: Array<{ st: GameState; key: string }> = [{ st: start, key: startKey }];
  let depth = 0;
  while (frontier.length > 0) {
    if (depth >= maxDepth) return { status: 'unknown' };
    if (deadlineMs !== undefined && nowMs() - t0 > deadlineMs) return { status: 'unknown' };
    depth++;
    const next: Array<{ st: GameState; key: string }> = [];
    let winKey: string | null = null;
    for (const node of frontier) {
      for (const dirn of DIRNAMES) {
        const r = move(level, node.st, dirn, { reports: false });
        if (!r.moved) continue;
        if (r.state.dots.length === 0) continue; // dead branch: dots never respawn
        const k = ser(r.state);
        const seen = dist.get(k);
        if (seen !== undefined) {
          if (seen === depth) ways.set(k, (ways.get(k) ?? 0) + (ways.get(node.key) ?? 0));
          continue;
        }
        dist.set(k, depth);
        ways.set(k, ways.get(node.key) ?? 1);
        parent.set(k, { prev: node.key, dir: dirn });
        if (dist.size > maxStates) return { status: 'unknown' };
        next.push({ st: r.state, key: k });
        if (isWin(level, r.state)) winKey = k;
      }
    }
    if (winKey !== null) {
      const solution: Dir[] = [];
      let k2 = winKey;
      while (k2 !== startKey) {
        const p = parent.get(k2);
        if (!p) break;
        solution.unshift(p.dir);
        k2 = p.prev;
      }
      return { status: 'solved', par: depth, ways: ways.get(winKey) ?? 1, solution };
    }
    frontier = next;
  }
  /* frontier emptied before any budget tripped: definitively unsolvable */
  return { status: 'unsolvable' };
}

/** True if hammering one direction — or alternating two — wins. Rejects boring levels. */
export function spamSolvable(level: Level, par: number, from?: GameState): boolean {
  const seqs: Dir[][] = [];
  for (const a of DIRNAMES) {
    seqs.push([a]);
    for (const b of DIRNAMES) if (b !== a) seqs.push([a, b]);
  }
  for (const seq of seqs) {
    let st = cloneState(from ?? level.initState);
    for (let i = 0; i < par + 3; i++) {
      const d = seq[i % seq.length] as Dir;
      const r = move(level, st, d);
      if (!r.moved) break;
      st = r.state;
      if (st.dots.length === 0) break;
      if (isWin(level, st)) return true;
    }
  }
  return false;
}

/** Replay a solution and report which mechanics the optimal line touches. */
export function featureUse(level: Level, solution: Dir[]): { used: Set<string>; win: boolean } {
  let st = cloneState(level.initState);
  const used = new Set<string>();
  for (const dirn of solution) {
    const r = move(level, st, dirn);
    for (const mv of r.movers) {
      for (const f of mv.fx) used.add(f.type);
      if (mv.stick) used.add('sticky');
      if (mv.end === 'die') used.add('nom');
      if (mv.end === 'merge') used.add('merge');
      if (mv.path.length > 1 && mv.kind !== 'dot') used.add(mv.kind + 'move');
      for (let pi = 1; pi < mv.path.length; pi++) {
        const step = mv.path[pi];
        if (!step) continue;
        if (step.hop) used.add('hop');
        if (level.oneway.has(key(step.x, step.y))) used.add('oneway');
      }
    }
    st = r.state;
  }
  return { used, win: isWin(level, st) };
}
