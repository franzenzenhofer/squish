/* Make a visible link open in an EXTERNAL browser, everywhere.

   In a normal browser a target=_blank anchor opens a new tab. Inside the iOS
   app:// WKWebView there is no working window.open (it returns null and the tap
   does nothing), so the link MUST stay a real navigable anchor: the app's
   WKNavigationDelegate sees the http(s) navigation and hands it to Safari. The
   one thing that breaks this is preventDefault on the click - so we never leave
   a click handler that could swallow the native navigation. */

/** The minimal anchor surface we set - HTMLAnchorElement satisfies it, so this
    stays DOM-free and unit-testable without a jsdom environment. */
export interface ExternalAnchor {
  href: string;
  target: string;
  rel: string;
  onclick: unknown;
}

export function setupExternalLink(a: ExternalAnchor, url: string): void {
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.onclick = null; // never swallow the native navigation (iOS app:// webview)
}
