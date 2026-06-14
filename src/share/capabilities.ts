/* Capability detection — feature-detect, never UA-sniff. Each detector takes
   its environment by argument so it is pure and unit-testable, and each maps to
   exactly one share button. Critical iOS fact: the app:// WKWebView scheme is
   NOT a secure context, so navigator.clipboard is unavailable there and
   navigator.share is unreliable — which is why the QR code (Canvas only) is the
   primary share path and copy/share are progressive enhancements. */

export interface ShareEnv {
  doc?: Document;
  nav?: Navigator;
  win?: Window;
}

export interface ShareCaps {
  canvas: boolean;
  share: boolean;
  shareFiles: boolean;
  clipboard: boolean;
  secure: boolean;
}

export function hasCanvas(doc: Document = document): boolean {
  try {
    return !!doc.createElement('canvas').getContext('2d');
  } catch {
    return false;
  }
}

export function hasWebShare(nav: Navigator = navigator): boolean {
  return typeof nav.share === 'function';
}

export function canShareFiles(nav: Navigator = navigator): boolean {
  if (typeof nav.canShare !== 'function') return false;
  try {
    const f = new File(['x'], 'probe.png', { type: 'image/png' });
    return nav.canShare({ files: [f] });
  } catch {
    return false;
  }
}

export function hasClipboardWrite(nav: Navigator = navigator, win: Window = window): boolean {
  return typeof nav.clipboard?.writeText === 'function' && win.isSecureContext === true;
}

export function isSecure(win: Window = window): boolean {
  return win.isSecureContext === true;
}

export function shareCapabilities(env: ShareEnv = {}): ShareCaps {
  const doc = env.doc ?? document;
  const nav = env.nav ?? navigator;
  const win = env.win ?? window;
  return {
    canvas: hasCanvas(doc),
    share: hasWebShare(nav),
    shareFiles: canShareFiles(nav),
    clipboard: hasClipboardWrite(nav, win),
    secure: isSecure(win)
  };
}
