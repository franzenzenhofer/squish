/* Logo — single source of truth for the "Squishy & Friends" lockup. The exact
   same heart glyph and wordmark markup is mounted in the in-game header and on
   the start screen; the canvas share card reuses LOGO_COLORS so the painted
   wordmark matches the DOM one. Change the brand here and nowhere else. */

/** The heart silhouette shared by the favicon, the header home button and the
    in-board target. */
export const HEART_PATH =
  'M16 28 C3 18 2 9 8.5 6.5 C13 4.5 16 8.5 16 12 C16 8.5 19 4.5 23.5 6.5 C30 9 29 18 16 28 Z';

export const HEART_SVG =
  `<svg viewBox="0 0 32 32" class="logo-heart" aria-hidden="true">` +
  `<path d="${HEART_PATH}" fill="currentColor"/></svg>`;

/** The two-line wordmark. `.wm-main` is the pink, white-outlined "Squishy";
    `.wm-sub` is the small "& Friends" plate tucked under the descenders. */
export const WORDMARK_HTML =
  `<span class="wordmark" aria-label="Squishy & Friends">` +
  `<span class="wm-main">Squishy</span>` +
  `<span class="wm-sub"><b>&amp;</b> Friends</span>` +
  `</span>`;

/** Colours the canvas share card paints to match the DOM wordmark. */
export const LOGO_COLORS = {
  main: '#FF7FAE',
  mainStroke: '#ffffff',
  sub: '#6B4A5B',
  amp: '#FF6D9E'
} as const;

/** Mount the wordmark into a container (replaces its contents). */
export function mountWordmark(el: HTMLElement): void {
  el.innerHTML = WORDMARK_HTML;
}
