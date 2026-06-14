/* Builder test API — window.__squishBuilder lets e2e tests and AI agents drive
   every editor action deterministically and read the full board state, the same
   way window.__squishy drives gameplay. Active in dev or with ?test=1. */

import type { BuilderApi } from './view';

declare global {
  interface Window {
    __squishBuilder?: BuilderApi;
  }
}

export function installBuilderTestApi(builder: BuilderApi): void {
  const enabled = import.meta.env.DEV ||
    new URLSearchParams(window.location.search).has('test');
  if (!enabled) return;
  window.__squishBuilder = builder;
}
