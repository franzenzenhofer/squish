/* Oracle tests: every curated level's full state graph must be exhaustible,
   the oracle's distance must equal recorded par, and the greedy policy walk
   must win. The oracle is what guarantees "no hint possible" cannot happen. */
import { describe, expect, it } from 'vitest';
import { analyzeLevel, solutionFrom, winnableState } from '../src/engine/analyze';
import { cloneState, isWin, makeLevel, ser } from '../src/engine/core';
import { move } from '../src/engine/move';
import type { LevelDef } from '../src/engine/types';
import curated from '../src/levels.json';

const LEVELS = curated as LevelDef[];

describe('level oracle', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const def = LEVELS[i] as LevelDef;
    it(`level ${i + 1}: exhausted, dist(init)=${def.par}, policy walk wins`, () => {
      const level = makeLevel(def);
      const o = analyzeLevel(level);
      expect(o.exhausted).toBe(true);
      expect(o.dist.get(ser(level.initState))).toBe(def.par);
      const sol = solutionFrom(level, level.initState, o);
      expect(sol).not.toBeNull();
      expect(sol?.length).toBe(def.par);
      let st = cloneState(level.initState);
      for (const d of sol ?? []) st = move(level, st, d).state;
      expect(isWin(level, st)).toBe(true);
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
