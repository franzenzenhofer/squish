/* The visible share link must open in an EXTERNAL browser everywhere - a normal
   browser opens a new tab, and inside the iOS app:// WKWebView the native
   navigation is what the app's WKNavigationDelegate intercepts to hand off to
   Safari. A swallowed window.open does nothing in that webview, so the link must
   stay a real navigable anchor (href + target=_blank + rel) and must NOT carry a
   click handler that could preventDefault the native navigation. */
import { beforeEach, describe, expect, it } from 'vitest';
import { setupExternalLink, type ExternalAnchor } from '../../src/share/externalLink';

const URL = 'https://squishy.franzai.com/#z-eJxABC';

describe('setupExternalLink', () => {
  let a: ExternalAnchor;
  beforeEach(() => {
    /* a stub anchor pre-loaded with a swallowing handler, to prove we clear it */
    a = { href: '', target: '', rel: '', onclick: () => undefined };
  });

  it('points the anchor at the url', () => {
    setupExternalLink(a, URL);
    expect(a.href).toBe(URL);
  });

  it('opens in a new top-level browsing context', () => {
    setupExternalLink(a, URL);
    expect(a.target).toBe('_blank');
  });

  it('isolates the opened tab (no opener back-reference)', () => {
    setupExternalLink(a, URL);
    expect(a.rel).toContain('noopener');
    expect(a.rel).toContain('noreferrer');
  });

  it('leaves no click handler that could swallow the native navigation', () => {
    setupExternalLink(a, URL);
    expect(a.onclick).toBeNull();
  });
});
