/* Hints — oracle-driven solvability checks and hint mode. After every state
   change the current position is looked up synchronously in the level's
   solved graph: dead → oh-no fires (always — no budget misses), winnable +
   hint mode → the next best move is shown. The deep-solve fallback only
   exists for states outside a non-exhausted oracle, which shipped levels
   never produce (generation rejects them); it logs loudly if it ever runs. */
import { solutionFrom, winnableState } from '../engine/analyze';
import { CODEDIR, DIRCODE, REV, cloneState, ser } from '../engine/core';
import { move } from '../engine/move';
import type { Dir, GameState, Level } from '../engine/types';
import type { Assist } from './assist';
import type { Session } from './session';
import { toast } from './toast';

/** Serialize a state for EQUIVALENCE on this level: parity only matters to
    pandas and lastDir only to chicks - without them, two states differing
    only there have identical futures. */
export function serEquivalent(level: Level, st: GameState): string {
  const c = cloneState(st);
  if (level.initState.pandas.length === 0) c.parity = 0;
  if (level.initState.chicks.length === 0) c.lastDir = null;
  return ser(c);
}

/** Franz's reversibility law: if the swipe that produced `state` can be
    EXACTLY undone by the opposite swipe (back to a state equivalent to
    `prev`), the state cannot be unsolvable - hop back, then play prev's
    solution. A correct exhausted oracle already knows this; the game still
    checks it before every oh-no as a tripwire against pipeline bugs. */
export function isReversibleEscape(
  level: Level, state: GameState, lastDir: Dir, prev: GameState
): boolean {
  const back = move(level, cloneState(state), REV[lastDir]);
  return back.moved && serEquivalent(level, back.state) === serEquivalent(level, prev);
}

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

  /* "Still thinking" bubble: when a hint can't be shown at once (the oracle is
     still being computed, or the state sits outside a truncated oracle and a
     deep solve is running), Squishy says so after a short beat instead of
     leaving the player tapping a dead button. Cleared the moment the arrow or a
     verdict lands. Applies to EVERY level. */
  const THINK_DELAY_MS = 3500; // only speak up if the solver has churned this long
  let thinkTimer: number | null = null;
  let thinking = false;

  const stopThinking = (): void => {
    if (thinkTimer !== null) { clearTimeout(thinkTimer); thinkTimer = null; }
    if (thinking) { thinking = false; hooks.caption('', false); }
  };

  const startThinking = (): void => {
    if (!s.hintMode || thinking || thinkTimer !== null) return;
    thinkTimer = window.setTimeout(() => {
      thinkTimer = null;
      if (!s.hintMode || s.mode !== 'idle') return;
      thinking = true;
      hooks.caption('Ooh, a tricky one - let me work out the way…', false);
    }, THINK_DELAY_MS);
  };

  const refreshHint = (): void => {
    if (!s.hintMode || !s.oracle) return;
    const dir = s.oracle.policy.get(ser(s.gs));
    s.hintDir = dir ? dir : null;
    s.hintT0 = performance.now();
    hooks.onHintChange(true, s.hintDir);
    if (s.hintDir) stopThinking();
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
    startThinking(); // a deep solve can take a beat; reassure the player meanwhile
    const frozen = ser(s.gs);
    void assist.deepSolve(s.def, s.gs).then((r) => {
      if (ser(s.gs) !== frozen || s.mode !== 'idle') return;
      if (r.status === 'unsolvable') {
        stopThinking();
        hooks.onUnwinnable();
      } else if (r.status === 'solved') {
        learnLine(r.solution.map((d) => d as Dir));
        refreshHint();
      } else {
        stopThinking();
        console.error('[squishy] deep solve exhausted budgets — cannot judge state');
        hooks.caption('This one is beyond me - try undo', true);
      }
    });
  };

  /* The single hint-resolution path, used on toggle, after a move, and when the
     oracle arrives. Shows the arrow if known, deep-solves if the state is
     outside a truncated oracle, and keeps the "thinking" bubble up meanwhile. */
  const requestHint = (): void => {
    if (!s.hintMode) return;
    if (!s.oracle || s.oracleKey !== currentKey) { startThinking(); hooks.onHintChange(true, null); return; }
    const w = winnableState(s.oracle, ser(s.gs));
    if (w === false) {
      stopThinking();
      s.hintDir = null;
      hooks.onHintChange(true, null);
      hooks.caption('No path to the heart from here - hop back!', true);
      return;
    }
    if (w === null) { hooks.onHintChange(true, null); deepFallback(); return; }
    refreshHint();
    if (!s.hintDir) hooks.onHintChange(true, null);
  };

  const afterStateChange = (): void => {
    if (s.mode !== 'idle') return;
    if (!s.oracle || s.oracleKey !== currentKey) { if (s.hintMode) startThinking(); return; }
    const w = winnableState(s.oracle, ser(s.gs));
    if (w === false) {
      /* oh-no fires on EVERY level, tutorials included. The first two levels
         each have heart-blocking moves (L1: left/right, L2: up/down); leaving
         beginners silently stuck there taught nothing - the gentle hop-back
         ("Squishy hopped back - the heart stays reachable") is the tutorial.
         (Root-cause fix, Franz 2026-06-14: removed the s.li<2 suppression.) */
      /* tripwire: an exactly-undoable swipe can never be a dead end. If the
         oracle disagrees, something upstream is broken - fail LOUD and never
         punish the player with a wrong oh-no. */
      const lastCode = s.line[s.line.length - 1];
      const prev = s.hist[s.hist.length - 1];
      if (lastCode && prev &&
          isReversibleEscape(s.level, s.gs, CODEDIR[lastCode], prev.gs)) {
        console.error(
          '[squishy] OH-NO CONTRADICTION: oracle judged a reversible state ' +
          'dead — oracle/def pipeline bug, state ' + ser(s.gs));
        return;
      }
      stopThinking();
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
      stopThinking();
      void assist.getOracle(cacheKey, s.def).then((o) => {
        if (currentKey !== cacheKey) return; // player moved to another level
        s.oracle = o;
        s.oracleKey = cacheKey;
        afterStateChange(); // oracle ready: shows the waiting player's hint / clears thinking
      });
    },
    afterStateChange,
    toggleHintMode: (): void => {
      s.hintMode = !s.hintMode;
      /* one peek is enough: this run's win earns no hearts (sticky until the
         level is reloaded — turning hints off again does not un-peek) */
      if (s.hintMode) s.hintUsed = true;
      toast(s.hintMode ? 'Hint mode on' : 'Hint mode off', { ms: 1300 });
      if (!s.hintMode) {
        s.hintDir = null;
        stopThinking();
        hooks.onHintChange(false, null);
        return;
      }
      requestHint();
    },
    solution: (): Dir[] | null =>
      s.oracle ? solutionFrom(s.level, s.gs, s.oracle) : null
  };
}

/** DirCode line for compact display/persistence. */
export function lineCodes(line: Dir[]): string {
  return line.map((d) => DIRCODE[d]).join('');
}
