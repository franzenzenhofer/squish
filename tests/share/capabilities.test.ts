/* Capability detection: pure detectors with injected env, each gating one
   button. Critical: clipboard requires a secure context (iOS app:// is not). */
import { describe, expect, it } from 'vitest';
import {
  hasCanvas, hasWebShare, canShareFiles, hasClipboardWrite, shareCapabilities
} from '../../src/share/capabilities';

const doc = (ok: boolean): Pick<Document, 'createElement'> => ({
  createElement: () => ({ getContext: () => (ok ? {} : null) }) as unknown as HTMLElement
});

describe('hasCanvas', () => {
  it('true when 2d context is obtainable', () => {
    expect(hasCanvas(doc(true) as Document)).toBe(true);
    expect(hasCanvas(doc(false) as Document)).toBe(false);
  });
});

describe('hasWebShare', () => {
  it('checks for a share function', () => {
    expect(hasWebShare({ share: () => Promise.resolve() } as unknown as Navigator)).toBe(true);
    expect(hasWebShare({} as Navigator)).toBe(false);
  });
});

describe('canShareFiles', () => {
  it('probes canShare with a real file', () => {
    const nav = { canShare: (d: { files: unknown[] }) => d.files.length > 0 } as unknown as Navigator;
    expect(canShareFiles(nav)).toBe(true);
    expect(canShareFiles({} as Navigator)).toBe(false);
  });
});

describe('hasClipboardWrite', () => {
  it('requires writeText AND a secure context', () => {
    const nav = { clipboard: { writeText: () => Promise.resolve() } } as unknown as Navigator;
    expect(hasClipboardWrite(nav, { isSecureContext: true } as Window)).toBe(true);
    expect(hasClipboardWrite(nav, { isSecureContext: false } as Window)).toBe(false);
    expect(hasClipboardWrite({} as Navigator, { isSecureContext: true } as Window)).toBe(false);
  });
});

describe('shareCapabilities', () => {
  it('aggregates all detectors', () => {
    const caps = shareCapabilities({
      doc: doc(true) as Document,
      nav: { share: () => Promise.resolve(), canShare: () => true } as unknown as Navigator,
      win: { isSecureContext: false } as Window
    });
    expect(caps.canvas).toBe(true);
    expect(caps.share).toBe(true);
    expect(caps.clipboard).toBe(false); // not secure
  });
});
