/* Hints — oracle-driven solvability checks and hint mode. After every state
   change the current position is looked up synchronously in the level's
   solved graph: dead → oh-no fires (always — no budget misses), winnable +
   hint mode → the next best move is shown. The deep-solve fallback only
   exists for states outside a non-exhausted oracle, which shipped levels
   never produce (generation rejects them); it logs loudly if it ever runs. */
import { solutionFrom, winnableState } from '../engine/analyze';
import { DIRCODE, ser } from '../engine/core';
import { move } from '../engine/move';
import type { Dir } from '../engine/types';
import type { Assist } from './assist';
import type { Session } from './session';

export interface HintHooks {
  /** current state is provably unwinnable — trigger the oh-no sequence */
  onUnwinnable: () => void;
  /** hint mode toggled or hint arrow refreshed */
  onHintChange: (on: boolean, dir: Dir | null) => void;
  caption: (txt: string, bad: boolean) => void;
}

export interface Hints {
  /** kick the oracle fetch for a freshly applied level */
  levelLoaded: (cacheKey: string) => void;
  /** call whenever s.gs changed and mode settled back to idle */
  afterStateChange: () => void;
  toggleHintMode: () => void;
  /** full optimal line from the current state (test API / debugging) */
  solution: () => Dir[] | null;
}

export function createHints(s: Session, assist: Assist, hooks: HintHooks): Hints {
  let currentKey = '';

  const refreshHint = (): void => {
    if (!s.hintMode || !s.oracle) return;
    const dir = s.oracle.policy.get(ser(s.gs));
    s.hintDir = dir ? dir : null;
    s.hintT0 = performance.now();
    hooks.onHintChange(true, s.hintDir);
  };

  /** Learn a deep-solved line into the oracle so follow-up lookups hit:
      replay it and label every state along the way. */
  const learnLine = (line: Dir[]): void => {
    if (!s.oracle) return;
    let st = s.gs;
    for (let i = 0; i < line.length; i++) {
      const dir = line[i] as Dir;
      s.oracle.policy.set(ser(st), dir);
      s.oracle.dist.set(ser(st), line.length - i);
      const r = move(s.level, st, dir);
      if (!r.moved) return; // line does not replay — stop labelling
      st = r.state;
    }
    s.oracle.dist.set(ser(st), 0);
    s.oracle.policy.set(ser(st), '');
  };

  const deepFallback = (): void => {
    console.warn('[squishy] state outside oracle — deep solve fallback');
    const frozen = ser(s.gs);
    void assist.deepSolve(s.def, s.gs).then((r) => {
      if (ser(s.gs) !== frozen || s.mode !== 'idle') return;
      if (r.status === 'unsolvable') {
        hooks.onUnwinnable();
      } else if (r.status === 'solved') {
        learnLine(r.solution.map((d) => d as Dir));
        refreshHint();
      } else {
        console.error('[squishy] deep solve exhausted budgets — cannot judge state');
        hooks.caption('this one is beyond me — try undo', true);
      }
    });
  };

  const afterStateChange = (): void => {
    if (s.mode !== 'idle') return;
    if (!s.oracle || s.oracleKey !== currentKey) return; // resolves on arrival
    const w = winnableState(s.oracle, ser(s.gs));
    if (w === false) {
      hooks.onUnwinnable();
      return;
    }
    if (w === null) {
      deepFallback();
      return;
    }
    refreshHint();
  };

  return {
    levelLoaded: (cacheKey: string): void => {
      currentKey = cacheKey;
      s.oracle = null;
      s.oracleKey = null;
      void assist.getOracle(cacheKey, s.def).then((o) => {
        if (currentKey !== cacheKey) return; // player moved to another level
        s.oracle = o;
        s.oracleKey = cacheKey;
        afterStateChange();
      });
    },
    afterStateChange,
    toggleHintMode: (): void => {
      s.hintMode = !s.hintMode;
      if (!s.hintMode) {
        s.hintDir = null;
        hooks.onHintChange(false, null);
        return;
      }
      if (s.oracle && winnableState(s.oracle, ser(s.gs)) === false) {
        hooks.caption('no path to the heart from here — hop back!', true);
      }
      refreshHint();
      if (!s.hintDir) hooks.onHintChange(true, null);
    },
    solution: (): Dir[] | null =>
      s.oracle ? solutionFrom(s.level, s.gs, s.oracle) : null
  };
}

/** DirCode line for compact display/persistence. */
export function lineCodes(line: Dir[]): string {
  return line.map((d) => DIRCODE[d]).join('');
}
