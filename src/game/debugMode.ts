/* Debug mode — hidden behind ?debug=doit (same URL-param pattern as the
   ?test=1 test API). Unlocks every level in the picker and reveals the
   generated 41-50 plus the hand-authored edge-case test levels. */

export function isDebug(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === 'doit';
}

/** How many endless/generated levels the debug picker exposes (41..50). */
export const DEBUG_GEN_COUNT = 10;
