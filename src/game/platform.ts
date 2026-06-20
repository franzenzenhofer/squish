/* Platform chrome SSOT - applies the build-target (web | ios) to the static
   DOM once at boot. Two jobs, both driven off VITE_PLATFORM via main.ts:

   1. Show/hide elements tagged `data-plat="web"|"ios"`. The load-bearing case
      is the "Download on the App Store" badge on the start screen: it is
      `data-plat="web"` so it appears ONLY on the hosted web build and never
      inside the iOS app. The iOS-only analytics opt-out row rides the same rule.
   2. Stamp the body with `plat-web` | `plat-ios` so CSS can branch layout per
      target (the web home collapses Levels/Create/Daily into one row to make
      space for the badge; iOS keeps the original stacked menu, untouched).

   The decision is a pure function so it is unit-testable without a DOM. */
import type { Platform } from '../lib/trackSchema';

/** A `data-plat`-tagged element is hidden unless its tag matches the running
    build target. Untagged (`undefined`) fails closed - hidden everywhere. */
export function hiddenForPlatform(elPlat: string | undefined, platform: Platform): boolean {
  return elPlat !== platform;
}

/** The body class CSS branches layout on, e.g. `plat-web`. */
export function platformBodyClass(platform: Platform): string {
  return `plat-${platform}`;
}

/** Apply both rules to a document (thin DOM wrapper over the pure decisions). */
export function applyPlatformChrome(platform: Platform, root: Document = document): void {
  root.body.classList.add(platformBodyClass(platform));
  for (const el of root.querySelectorAll<HTMLElement>('[data-plat]')) {
    el.hidden = hiddenForPlatform(el.dataset.plat, platform);
  }
}
