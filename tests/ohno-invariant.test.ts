/* Oh-no correctness — Franz's reversibility insight, locked as law:
   if the swipe that entered a state can be EXACTLY undone by the opposite
   swipe, that state cannot be unsolvable (hop back, then play the previous
   state's solution). Two layers:
   1. property test: every exhausted oracle must already honor this for every
      reversible edge of every curated level - a failure = engine/analyze bug
   2. unit tests for the runtime tripwire helper the game uses before ever
      firing the oh-no */
import { describe, expect, it } from 'vitest';
import { analyzeLevel, winnableState } from '../src/engine/analyze';
import { DIRNAMES, REV, cloneState, isWin, makeLevel, ser } from '../src/engine/core';
import { move } from '../src/engine/move';
import type { Dir, GameState, LevelDef } from '../src/engine/types';
import { isReversibleEscape, serEquivalent } from '../src/game/hints';
import levels from '../src/levels.json';
import { oncePerLevel } from './_solverCache';

describe('reversibility invariant (every exhausted oracle honors it)', () => {
  const CURATED = (levels as LevelDef[]).slice(0, 25);

  it('winnable(S) and exact reverse T->S imply winnable(T), on every curated edge', () => {
    for (let li = 0; li < CURATED.length; li++) {
      /* each level's invariant is proven once per (engine, level) then cached */
      oncePerLevel(CURATED[li] as LevelDef, 'reversibility', () => {
        const level = makeLevel(CURATED[li] as LevelDef);
        const oracle = analyzeLevel(level);
        expect(oracle.exhausted, 'L' + (li + 1) + ' oracle must exhaust').toBe(true);
        /* walk the reachable graph with real states in hand. Win states are
           terminal (the game ends there) — walking past them would invent
           phantom states the oracle rightly never explores. */
        const seen = new Set<string>([ser(level.initState)]);
        let frontier: GameState[] = [cloneState(level.initState)];
        while (frontier.length > 0) {
          const next: GameState[] = [];
          for (const S of frontier) {
            if (isWin(level, S)) continue;
            const sk = ser(S);
            /* the invariant needs a POSITIVELY winnable S (in the oracle's
               dist map) — null would be a phantom, not a proof */
            const sWinnable = winnableState(oracle, sk) === true;
            for (const d of DIRNAMES) {
              const r = move(level, cloneState(S), d);
              if (!r.moved || r.state.dots.length === 0) continue;
              const tk = ser(r.state);
              if (sWinnable) {
                const back = move(level, cloneState(r.state), REV[d]);
                if (back.moved &&
                    serEquivalent(level, back.state) === serEquivalent(level, S)) {
                  expect(
                    winnableState(oracle, tk),
                    'L' + (li + 1) + ': reversible move ' + d + ' from winnable ' +
                    sk + ' may NEVER be judged dead'
                  ).not.toBe(false);
                }
              }
              if (!seen.has(tk)) {
                seen.add(tk);
                next.push(r.state);
              }
            }
          }
          frontier = next;
        }
      });
    }
  }, 240000);
});

describe('isReversibleEscape (the runtime tripwire)', () => {
  it('detects an exactly-undoable swipe', () => {
    /* empty 3x3: dot slid left to the wall; swiping right returns it */
    const def: LevelDef = { w: 3, h: 3, target: [0, 0], dots: [[2, 1]], par: 1 };
    const level = makeLevel(def);
    const prev = cloneState(level.initState);
    const r = move(level, cloneState(prev), 'left');
    expect(r.moved).toBe(true);
    expect(isReversibleEscape(level, r.state, 'left' as Dir, prev)).toBe(true);
  });

  it('is honest when the world changed (ice broke on the way)', () => {
    /* crossing ice breaks it - the reverse swipe cannot restore the floor */
    const def: LevelDef = {
      w: 4, h: 3, target: [0, 0], dots: [[3, 1]], ice: [[1, 1]], par: 1
    };
    const level = makeLevel(def);
    const prev = cloneState(level.initState);
    const r = move(level, cloneState(prev), 'left');
    expect(r.moved).toBe(true);
    expect(r.state.broken.size).toBeGreaterThan(0);
    expect(isReversibleEscape(level, r.state, 'left' as Dir, prev)).toBe(false);
  });
});
