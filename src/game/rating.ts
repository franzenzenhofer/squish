/* Heart rating — the single source of truth for how a clean (hint-free) solve
   earns 1-3 hearts from its move count versus the level par (the optimal). Both
   the win card (endings.ts) and the level picker (levelsPick.ts) call this so the
   bands can never drift apart. A hinted solve earns no hearts and is handled by
   the caller, not here. */

/** Hearts (1-3) for a hint-free solve: moves vs level par (optimal). */
export function heartsFor(moves: number, par: number): number {
  if (moves <= par + 1) return 3;   // optimal or one over
  if (moves <= par * 2) return 2;   // up to double optimal
  return 1;                          // any hint-free solve worse than that
}
