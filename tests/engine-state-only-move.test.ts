/* State-only move mode is the solver/oracle fast path: it must produce exactly
   the same next state as the animation/reporting move while allocating no
   mover reports. Sample reachable states across mechanics-heavy levels so the
   contract covers portals, ice, pigs, chicks, cats, stars and friends. */
import { describe, expect, it } from 'vitest';
import { makeLevel, ser } from '../src/engine/core';
import { move } from '../src/engine/move';
import type { Dir, GameState, Level, LevelDef } from '../src/engine/types';
import { DEBUG_LEVELS } from '../src/game/debugLevels';
import curated from '../src/levels.json';

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];
const CURATED = curated as LevelDef[];

function sampleReachableStates(level: Level, maxStates: number): GameState[] {
  const states: GameState[] = [level.initState];
  const seen = new Set<string>([ser(level.initState)]);
  for (let i = 0; i < states.length && states.length < maxStates; i++) {
    const st = states[i] as GameState;
    for (const dir of DIRS) {
      const r = move(level, st, dir);
      if (!r.moved || r.state.dots.length === 0) continue;
      const k = ser(r.state);
      if (seen.has(k)) continue;
      seen.add(k);
      states.push(r.state);
      if (states.length >= maxStates) break;
    }
  }
  return states;
}

describe('state-only move fast path', () => {
  it('matches reportful moves across reachable mechanics-heavy states', () => {
    const defs: LevelDef[] = [
      ...DEBUG_LEVELS.map((d) => d.def),
      ...[16, 27, 38, 42, 44, 45, 49].map((n) => CURATED[n] as LevelDef)
    ];

    let checked = 0;
    let reportfulTransitions = 0;
    for (const def of defs) {
      const level = makeLevel(def);
      for (const st of sampleReachableStates(level, 250)) {
        for (const dir of DIRS) {
          const full = move(level, st, dir);
          const fast = move(level, st, dir, { reports: false });
          expect(fast.moved, 'moved mismatch on ' + dir).toBe(full.moved);
          expect(fast.state, 'state mismatch on ' + dir).toEqual(full.state);
          expect(fast.movers, 'state-only mode must not allocate reports').toEqual([]);
          if (full.movers.length > 0) reportfulTransitions++;
          checked++;
        }
      }
    }

    expect(checked).toBeGreaterThan(1000);
    expect(reportfulTransitions).toBeGreaterThan(100);
  });
});
