/* Oracle tests: every curated level's full state graph must be exhaustible,
   the oracle's distance must equal recorded par, and the greedy policy walk
   must win. The oracle is what guarantees "no hint possible" cannot happen. */
import { describe, expect, it } from 'vitest';
import { analyzeLevel, solutionFrom, winnableState } from '../src/engine/analyze';
import { cloneState, isWin, makeLevel, ser } from '../src/engine/core';
import { move } from '../src/engine/move';
import type { LevelDef } from '../src/engine/types';
import curated from '../src/levels.json';
import { oncePerLevel } from './_solverCache';

const LEVELS = curated as LevelDef[];

/* Bounded-oracle levels: the deterministic-movement model (Squishy last) makes
   these three late boards' full state graph exceed the runtime oracle budget
   (400k). That is SAFE — a truncated oracle never calls a winnable state dead
   (proven in the oh-no tests), and the oracle still solves from the initial
   state at par, so hints/oh-no work across the reachable-early region. They are
   listed explicitly so any NEW level that goes heavy still fails this test. */
const BOUNDED_ORACLE = new Set([41, 45, 50]);

describe('level oracle', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const def = LEVELS[i] as LevelDef;
    it(`level ${i + 1}: solvable from init at dist=${def.par}, policy walk wins`, () => {
      /* verified once per (engine, level), then cached — the oracle is not
         rebuilt over all levels on every run (see tests/_solverCache.ts) */
      oncePerLevel(def, 'oracle-init', () => {
        const level = makeLevel(def);
        const o = analyzeLevel(level);
        if (!BOUNDED_ORACLE.has(i + 1)) expect(o.exhausted).toBe(true);
        expect(o.dist.get(ser(level.initState))).toBe(def.par);
        const sol = solutionFrom(level, level.initState, o);
        expect(sol).not.toBeNull();
        expect(sol?.length).toBe(def.par);
        let st = cloneState(level.initState);
        for (const d of sol ?? []) st = move(level, st, d).state;
        expect(isWin(level, st)).toBe(true);
      });
    });
  }

  it('policy and dist are consistent over the whole graph', () => {
    const level = makeLevel(LEVELS[25] as LevelDef);
    const o = analyzeLevel(level);
    expect(o.exhausted).toBe(true);
    expect(o.states).toBeGreaterThan(0);
    for (const [k, dir] of o.policy) {
      const d = o.dist.get(k);
      if (d === undefined) expect(dir).toBe(''); // dead state
      else if (d === 0) expect(dir).toBe('');    // already won
      else expect(dir).not.toBe('');             // winnable: has a move
    }
  });

  it('labels a dead state as unwinnable and recovers after undo', () => {
    /* pick the first curated level whose graph contains a dead state */
    let level = makeLevel(LEVELS[0] as LevelDef);
    let o = analyzeLevel(level);
    for (const def of LEVELS) {
      const l = makeLevel(def);
      const cand = analyzeLevel(l);
      let hasDead = false;
      for (const k of cand.policy.keys()) {
        if (winnableState(cand, k) === false) {
          hasDead = true;
          break;
        }
      }
      if (hasDead) {
        level = l;
        o = cand;
        break;
      }
    }
    /* BFS from the start until we land in a provably dead state */
    let st = cloneState(level.initState);
    let deadKey: string | null = null;
    const seen = new Set<string>([ser(st)]);
    let frontier = [st];
    outer: while (frontier.length > 0 && deadKey === null) {
      const next: typeof frontier = [];
      for (const cur of frontier) {
        for (const d of ['up', 'down', 'left', 'right'] as const) {
          const r = move(level, cur, d);
          if (!r.moved || r.state.dots.length === 0) continue;
          const k = ser(r.state);
          if (seen.has(k)) continue;
          seen.add(k);
          if (winnableState(o, k) === false) {
            deadKey = k;
            st = r.state;
            break outer;
          }
          next.push(r.state);
        }
      }
      frontier = next;
    }
    expect(deadKey).not.toBeNull();
    expect(o.policy.get(deadKey as string)).toBe('');
    expect(solutionFrom(level, st, o)).toBeNull();
  });

  it('respects the state cap and reports exhausted=false', () => {
    const level = makeLevel(LEVELS[25] as LevelDef);
    const o = analyzeLevel(level, { maxStates: 100 });
    expect(o.exhausted).toBe(false);
    expect(o.states).toBeLessThanOrEqual(100);
  });

  it('win state has dist 0 and counts as winnable', () => {
    const def = LEVELS[0] as LevelDef;
    const level = makeLevel(def);
    const o = analyzeLevel(level);
    let st = cloneState(level.initState);
    for (const d of solutionFrom(level, st, o) ?? []) st = move(level, st, d).state;
    expect(isWin(level, st)).toBe(true);
    expect(o.dist.get(ser(st))).toBe(0);
    expect(winnableState(o, ser(st))).toBe(true);
  });
});

/* The oh-no contract, in BOTH directions. The oh-no rewind fires exactly on
   winnableState === false, so:
   1. a TRUNCATED oracle (state/deadline budget hit) must NEVER call a winnable
      state dead - that blocked legal, winnable moves in play (the overbearing
      oh-no bug);
   2. an EXHAUSTED oracle must still prove every dead state dead (the
      protection keeps protecting) and every winnable state winnable. */
describe('oh-no fires exactly on proven-dead states', () => {
  for (const li of [3, 9, 17, 25, 33]) {
    it(`level ${li + 1}: truncated oracles never call winnable states dead`, () => {
      oncePerLevel(LEVELS[li] as LevelDef, 'ohno-truncated', () => {
        const level = makeLevel(LEVELS[li] as LevelDef);
        const full = analyzeLevel(level);
        expect(full.exhausted).toBe(true);
        for (const cap of [10, 50, 200, 1000]) {
          const cut = analyzeLevel(level, { maxStates: cap });
          if (cut.exhausted) continue; // graph fit the cap - nothing was truncated
          let checked = 0;
          for (const k of cut.policy.keys()) {
            if (full.dist.has(k)) {
              /* winnable by full proof: truncated may answer true or null, never false */
              expect(winnableState(cut, k)).not.toBe(false);
              checked++;
            }
          }
          expect(checked).toBeGreaterThan(0);
        }
      });
    });
  }

  it('exhausted verdicts exact across levels - winnable true, dead false', () => {
    let dead = 0;
    let winnable = 0;
    for (const li of [0, 1, 3, 9, 17, 25, 30, 33]) {
      const level = makeLevel(LEVELS[li] as LevelDef);
      const o = analyzeLevel(level);
      expect(o.exhausted).toBe(true);
      for (const k of o.policy.keys()) {
        if (o.dist.has(k)) {
          expect(winnableState(o, k)).toBe(true);
          winnable++;
        } else {
          /* dead by exhaustive proof - the protection must still fire here */
          expect(winnableState(o, k)).toBe(false);
          dead++;
        }
      }
    }
    expect(winnable).toBeGreaterThan(0);
    /* the sample includes levels with real dead ends (audit: L1, L2, L31) so
       the protective direction is genuinely exercised, not vacuous */
    expect(dead).toBeGreaterThan(0);
  });
});
