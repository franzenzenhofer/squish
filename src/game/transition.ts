/* Transitions — levels never pop. A soft pink veil fades over the old board,
   the new one applies beneath it, the veil lifts while the board blooms in.
   After a win, the pink flood instead DRAINS into the next level's heart. */

const FADE_IN_MS = 240;
const DRAIN_MS = 420;

/** Fade the veil in, run `apply` (may await level data), fade out. */
export function fadeSwap(reduced: boolean, apply: () => Promise<void>): void {
  const el = document.getElementById('fade');
  if (!el || reduced) {
    void apply();
    return;
  }
  el.classList.add('show');
  const shown = new Promise((r) => setTimeout(r, FADE_IN_MS));
  void Promise.all([shown, apply()]).then(() => {
    requestAnimationFrame(() => el.classList.remove('show'));
  });
}

/** The post-win handover: the screen is still flooded pink — contract the
    flood into the NEW level's heart so the color literally drains into the
    next goal. */
export function drainFlood(reduced: boolean, px: number, py: number): void {
  const el = document.getElementById('flood');
  if (!el) return;
  if (reduced) {
    el.style.transition = 'none';
    el.style.clipPath = 'circle(0px at 50% 50%)';
    return;
  }
  el.style.transition = 'none';
  el.style.clipPath = 'circle(150% at ' + px + 'px ' + py + 'px)';
  void el.offsetWidth;
  el.style.transition = 'clip-path .42s cubic-bezier(.7,.05,.85,.4)';
  el.style.clipPath = 'circle(0px at ' + px + 'px ' + py + 'px)';
  setTimeout(() => {
    el.style.transition = 'none';
  }, DRAIN_MS + 30);
}
