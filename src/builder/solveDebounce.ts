/* Solve supersede runner. Each run() bumps a token; when an async solve
   resolves, its result is applied only if its token is still the latest. This
   guarantees that rapid edits can never leave a stale solvable/unsolvable
   verdict on the status pill. The solver is injected (the worker client in the
   app, a fake in tests). */

import type { LevelDef } from '../engine/types';

export type SolveOutcome = 'solvable' | 'unsolvable' | 'unknown';
export type SolveStatus = 'idle' | 'checking' | SolveOutcome;

export interface SolveRunner {
  run(def: LevelDef): void;
  cancel(status?: SolveStatus): void;
}

export function createSolveRunner(
  solve: (def: LevelDef) => Promise<SolveOutcome>,
  onStatus: (status: SolveStatus) => void
): SolveRunner {
  let token = 0;
  return {
    cancel(status: SolveStatus = 'idle'): void {
      token++;
      onStatus(status);
    },
    run(def: LevelDef): void {
      const mine = ++token;
      onStatus('checking');
      void solve(def).then(
        (outcome) => { if (mine === token) onStatus(outcome); },
        () => { if (mine === token) onStatus('unknown'); }
      );
    }
  };
}
