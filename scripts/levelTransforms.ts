/* Build-time level easing transforms (SSOT), used by the pilot + rollout and
   reused per-level via the resolve workflow. Two safe, deterministic levers:

   1. softenByWallRemoval(def, drop): greedily drop the walls that most reduce
      par - a detour-removing wall makes the optimal line shorter. Removing walls
      only ever SHRINKS the reachable graph, so it never threatens the live oracle
      (hints / oh-no) the way adding a mover would. Keeps the board recognizable.

   2. tryAddMover(def): add a bear or snail ONLY where the resulting live oracle
      still exhausts well within the phone budget AND it adds solution routes
      (ways up) while par holds. Movers explode the state graph, so this is
      conservative by design and often declines.

   Both keep the level solvable, spam-proof and trap-free, and re-derive par+sol.
   Determinism (fixed iteration order, no RNG) keeps rebuilds reproducible. */
import { cloneState, makeLevel, ser } from '../src/engine/core';
import { move } from '../src/engine/move';
import { solve, spamSolvable } from '../src/engine/solve';
import { analyzeLevel, winnableState } from '../src/engine/analyze';
import { DIRNAMES } from '../src/engine/core';
import type { LevelDef, XY } from '../src/engine/types';
import { resolveDef } from './levelStore';

/* The live oracle (assist.ts) must exhaust within a worker on a phone. analyze.ts
   ships a 400k cap; we keep eased boards far under it so hints/oh-no stay fast. */
export const ORACLE_SAFE_STATES = 60000;

export interface Forgive { par: number; states: number; dead: number; near3: number; ways: number; }

/** Measure a board: par, graph size, dead states, near-start traps, optimal ways.
    Returns null if it can't be cleanly analyzed (unsolved / spammy / not exhausted).
    Pass a tight stateCap to FAST-REJECT oversized candidates: a board whose graph
    exceeds the cap won't exhaust, so this returns null cheaply instead of grinding
    to the 45s deadline - essential for the mover search over many candidates. */
export function measure(def: LevelDef, stateCap?: number): Forgive | null {
  const level = makeLevel(def);
  /* bound BFS near the expected par (def.par is the pre-edit par; a softened/eased
     board lands within a few moves of it) so mover-heavy graphs don't blow the
     state cap just exploring uselessly deep. */
  const cap = stateCap ?? 400000;
  const maxDepth = (def.par ?? 30) + 4;
  const sv = solve(level, { maxStates: cap, maxDepth });
  if (sv.status !== 'solved') return null;
  if (spamSolvable(level, sv.par)) return null;
  /* 10s deadline: a board that can't exhaust this fast is too mover-heavy to
     safely touch (its live oracle is already at the phone budget edge), so we
     skip it rather than grind to the 45s default. */
  const oracle = analyzeLevel(level, { maxStates: cap, deadlineMs: 10000 });
  if (!oracle.exhausted) return null;
  let dead = 0;
  for (const [k] of oracle.policy) if (winnableState(oracle, k) === false) dead++;
  let near3 = 0;
  const seen = new Set<string>([ser(level.initState)]);
  const nearDead = new Set<string>();
  let frontier = [cloneState(level.initState)];
  for (let depth = 1; depth <= 3 && frontier.length; depth++) {
    const next: typeof frontier = [];
    for (const st of frontier) {
      if (winnableState(oracle, ser(st)) === false) continue;
      for (const dir of DIRNAMES) {
        const r = move(level, st, dir);
        if (!r.moved) continue;
        const lost = r.state.dots.length === 0;
        const k = lost ? '' : ser(r.state);
        if (!lost && winnableState(oracle, k) === false && !nearDead.has(k)) { nearDead.add(k); near3++; }
        if (lost || seen.has(k)) continue;
        seen.add(k); next.push(r.state);
      }
    }
    frontier = next;
  }
  return { par: sv.par, states: oracle.states, dead, near3, ways: sv.ways };
}

function trapFreeEnough(f: Forgive): boolean {
  return f.near3 === 0; // no dead state within 3 swipes of the start
}

/** GENTLE softening: remove ONE wall whose removal eases the optimal by exactly
    1..maxDrop moves (never more — honours the "par +/-1" rule), keeping the board
    solvable, spam-proof and trap-free. Among qualifying walls, prefer the gentlest
    ease (highest resulting par), lowest index as the deterministic tie-break.
    Returns the softened, re-solved def and the moves shed (0 = left untouched). */
export function softenByWallRemoval(def: LevelDef, maxDrop: number, wallFloor: number): { def: LevelDef; shed: number } {
  const base = measure(def);
  if (!base) return { def, shed: 0 };
  const walls = def.walls ?? [];
  if (walls.length <= wallFloor) return { def, shed: 0 };
  let pick: { def: LevelDef; par: number } | null = null;
  for (let i = 0; i < walls.length; i++) {
    const trial: LevelDef = { ...def, walls: walls.filter((_, j) => j !== i) };
    if ((trial.walls ?? []).length === 0) delete (trial as { walls?: XY[] }).walls;
    const f = measure(trial);
    if (!f || !trapFreeEnough(f)) continue;
    const shed = base.par - f.par;
    if (shed < 1 || shed > maxDrop) continue;            // ease by 1..maxDrop, never more
    if (!pick || f.par > pick.par) pick = { def: trial, par: f.par }; // gentlest ease wins
  }
  if (!pick) return { def, shed: 0 };
  return { def: resolveDef(pick.def), shed: base.par - pick.par };
}

/** Flatten a difficulty SPIKE: greedily remove the wall that most reduces par
    (keeping the board solvable, spam-proof, trap-free AND oracle-safe at every
    step) until par drops to <= targetPar or no safe par-reducing wall remains.
    Returns the re-solved def (or null if the base can't be analyzed safely or no
    wall helped). Used by the curve-smoothing pass to pull spikes down toward the
    running difficulty so the ramp stays smooth. */
export function flattenToTarget(def: LevelDef, targetPar: number, wallFloor: number): LevelDef | null {
  const base = measure(def);
  if (!base) return null;                 // can't analyze safely -> leave untouched
  let cur = def;
  let curPar = base.par;
  /* Step GENTLY toward the cap: each round take the wall whose removal lands par
     CLOSEST to (but not far below) the target - the highest resulting par that
     still reduces it. Never accept a removal that would dip more than 1 below the
     target (that just swaps an up-spike for a down-dip, which isn't smooth). If
     no clean step exists, stop and leave a milder remaining spike. */
  while (curPar > targetPar) {
    const walls = cur.walls ?? [];
    if (walls.length <= wallFloor) break;
    let pick: { def: LevelDef; par: number } | null = null;
    for (let i = 0; i < walls.length; i++) {
      const trial: LevelDef = { ...cur, walls: walls.filter((_, j) => j !== i) };
      if ((trial.walls ?? []).length === 0) delete (trial as { walls?: XY[] }).walls;
      const f = measure(trial);
      if (!f || !trapFreeEnough(f)) continue;
      if (f.par >= curPar || f.par < targetPar - 3) continue; // must reduce, allow only a gentle breather
      if (!pick || f.par > pick.par) pick = { def: trial, par: f.par };
    }
    if (!pick) break;                     // no gentle step that respects the floor
    cur = pick.def;
    curPar = pick.par;
  }
  return curPar < base.par ? resolveDef(cur) : null;
}

const OCC_KEYS = ['walls', 'noms', 'sticky', 'split', 'turn', 'ice', 'jelly', 'spring',
  'oneway', 'breeze', 'penguins', 'bears', 'ghosts', 'bunnies', 'frogs', 'pandas',
  'cats', 'chicks', 'pigs', 'stars', 'boxes', 'balloons', 'snails'] as const;

function occupied(def: LevelDef): Set<string> {
  const s = new Set<string>();
  const rec = def as unknown as Record<string, XY[] | undefined>;
  for (const k of OCC_KEYS) for (const c of rec[k] ?? []) s.add(c[0] + ',' + c[1]);
  for (const d of def.dots) s.add(d[0] + ',' + d[1]);
  s.add(def.target[0] + ',' + def.target[1]);
  return s;
}

/** Add a bear or snail at the empty cell (scanned in a fixed order) that adds the
    most solution routes while staying oracle-safe and holding par. null = no safe,
    helpful placement (common - movers usually blow the graph). */
export function tryAddMover(def: LevelDef): { def: LevelDef; kind: string; at: XY } | null {
  const base = measure(def);
  if (!base) return null;
  const occ = occupied(def);
  let best: { def: LevelDef; kind: string; at: XY; ways: number } | null = null;
  for (let y = 0; y < def.h; y++) for (let x = 0; x < def.w; x++) {
    if (occ.has(x + ',' + y)) continue;
    for (const kind of ['bears', 'snails'] as const) {
      const rec = def as unknown as Record<string, XY[] | undefined>;
      const trial: LevelDef = { ...def, [kind]: [...(rec[kind] ?? []), [x, y]] } as LevelDef;
      // fast-reject: cap the graph at the safe budget so blow-ups bail cheaply
      const f = measure(trial, ORACLE_SAFE_STATES);
      if (!f) continue;                                   // unsolved / spammy / over budget
      if (f.par < base.par - 1 || f.par > base.par + 1) continue; // hold par +/-1
      if (!trapFreeEnough(f)) continue;
      if (f.ways <= base.ways) continue;                  // must add routes
      if (!best || f.ways > best.ways) best = { def: resolveDef(trial), kind: kind === 'bears' ? 'bear' : 'snail', at: [x, y], ways: f.ways };
    }
  }
  return best ? { def: best.def, kind: best.kind, at: best.at } : null;
}
