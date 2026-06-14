/* Debug test levels are contracts: every def must analyze exhaustively (the
   in-game oracle never has blind spots), its recorded sol must replay to a
   win at exactly par, and the trap levels must really contain the proven dead
   opening states they exist to exercise. */
import { describe, expect, it } from 'vitest';
import { analyzeLevel, winnableState } from '../src/engine/analyze';
import { CODEDIR, DIRNAMES, cloneState, isWin, makeLevel, ser } from '../src/engine/core';
import { move } from '../src/engine/move';
import type { DirCode } from '../src/engine/types';
import { DEBUG_LEVELS } from '../src/game/debugLevels';
import { cachedSolve, cachedExhausts } from './_solverCache';

/** Provably dead (or losing) opening swipes from the initial state. */
function deadOpenings(def: (typeof DEBUG_LEVELS)[number]['def']): number {
  const level = makeLevel(def);
  const oracle = analyzeLevel(level);
  let dead = 0;
  for (const d of DIRNAMES) {
    const r = move(level, cloneState(level.initState), d);
    if (!r.moved) continue;
    if (r.state.dots.length === 0 || winnableState(oracle, ser(r.state)) === false) dead++;
  }
  return dead;
}

describe('debug levels', () => {
  for (const t of DEBUG_LEVELS) {
    it(t.name + ': oracle exhausts, sol wins at par', () => {
      /* solver + oracle verdicts are memoised to .solver-cache.json — computed
         once per level, reused on every later run (no BFS over all levels again) */
      expect(cachedExhausts(t.def), 'oracle must exhaust').toBe(true);

      const level = makeLevel(t.def);
      let st = cloneState(level.initState);
      for (const c of (t.def.sol ?? '').split('') as DirCode[]) {
        const r = move(level, st, CODEDIR[c]);
        expect(r.moved, 'sol step ' + c + ' must move').toBe(true);
        st = r.state;
      }
      expect(isWin(level, st), 'sol must end on the heart').toBe(true);

      const res = cachedSolve(t.def, { maxStates: 500000, maxDepth: t.def.par + 2 });
      expect(res.status).toBe('solved');
      if (res.status === 'solved') expect(res.par, 'par must be optimal').toBe(t.def.par);
    }, 20000); /* generous cold-run headroom; warm runs read the cache instantly */
  }

  it('Oh-no trap: every effective non-winning opening is provably dead', () => {
    const trap = DEBUG_LEVELS[0];
    expect(trap?.name).toBe('Oh-no trap');
    expect(deadOpenings((trap as (typeof DEBUG_LEVELS)[number]).def)).toBeGreaterThanOrEqual(2);
  });

  it('Nomster chomp: one opening loses every squishy', () => {
    const t = DEBUG_LEVELS[1] as (typeof DEBUG_LEVELS)[number];
    expect(t.name).toBe('Nomster chomp');
    const level = makeLevel(t.def);
    const losing = DIRNAMES.filter((d) => {
      const r = move(level, cloneState(level.initState), d);
      return r.moved && r.state.dots.length === 0;
    });
    expect(losing.length).toBeGreaterThanOrEqual(1);
  });
});
