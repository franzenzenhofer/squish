/* Platform chrome SSOT - decides which build-target-specific bits of UI show.
   The load-bearing case for this feature: the "Download on the App Store"
   badge is tagged data-plat="web" and must appear ONLY on the hosted web
   build, never inside the iOS app (where the user already has the app). The
   same rule keeps the iOS-only analytics opt-out row off the web. */
import { describe, expect, it } from 'vitest';
import { hiddenForPlatform, platformBodyClass } from '../../src/game/platform';

describe('hiddenForPlatform', () => {
  it('shows a data-plat="web" element (the App Store badge) on web, hides it on iOS', () => {
    expect(hiddenForPlatform('web', 'web')).toBe(false);
    expect(hiddenForPlatform('web', 'ios')).toBe(true);
  });

  it('shows a data-plat="ios" element (the opt-out row) on iOS, hides it on web', () => {
    expect(hiddenForPlatform('ios', 'ios')).toBe(false);
    expect(hiddenForPlatform('ios', 'web')).toBe(true);
  });

  it('hides an untagged element on every platform (fail-closed)', () => {
    expect(hiddenForPlatform(undefined, 'web')).toBe(true);
    expect(hiddenForPlatform(undefined, 'ios')).toBe(true);
  });
});

describe('platformBodyClass', () => {
  it('namespaces the body so CSS can branch layout per target', () => {
    expect(platformBodyClass('web')).toBe('plat-web');
    expect(platformBodyClass('ios')).toBe('plat-ios');
  });
});
