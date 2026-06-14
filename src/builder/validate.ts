/* Tier-1 structural validation — cheap, synchronous, drives the speech-bubble
   hints and the gate before the expensive solver runs. Full solvability is
   checked asynchronously elsewhere (solveDebounce + the worker). */

import { type BuilderState, dotCount } from './state';

/** Human, specific hints — empty array means structurally complete. */
export function structuralErrors(s: BuilderState): string[] {
  const out: string[] = [];
  if (!s.target) out.push('Drop a heart for the squishies to reach!');
  if (dotCount(s) === 0) out.push('Add at least one squishy!');
  return out;
}

/** Only run the solver once the board is structurally complete. */
export function canSolveCheck(s: BuilderState): boolean {
  return s.target !== null && dotCount(s) > 0;
}
