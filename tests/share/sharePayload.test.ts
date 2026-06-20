/* The share-sheet payload rule: a tap on Share should hand the platform the
   image AND the url AND the text together. If the platform will not carry all
   three at once, the link wins - we drop the picture and share url + text, never
   an image with no way back to the game. The decision is pure and capability
   driven (navigator.canShare), so it is unit-testable without a share sheet. */
import { describe, expect, it } from 'vitest';
import { chooseShare, planShare } from '../../src/share/sharePayload';

const file = (name: string, type = 'image/gif'): File => new File(['x'], name, { type });
const TEXT = 'Squishy & Friends Level 7 - Can you solve it?';
const URL = 'https://squishy.franzai.com/#level-7-abc';

describe('chooseShare', () => {
  it('shares image + url + text when the platform accepts all three', () => {
    const gif = file('a.gif');
    expect(chooseShare(TEXT, URL, [gif], () => true)).toEqual({ text: TEXT, url: URL, files: [gif] });
  });

  it('prefers the first file (gif) over later candidates (png)', () => {
    const gif = file('a.gif');
    const png = file('b.png', 'image/png');
    const r = chooseShare(TEXT, URL, [gif, png], (d) => !!d.files);
    expect(r.files).toEqual([gif]);
  });

  it('falls through to the next file when the first cannot be shared', () => {
    const gif = file('a.gif');
    const png = file('b.png', 'image/png');
    const r = chooseShare(TEXT, URL, [gif, png], (d) => d.files?.[0]?.name === 'b.png');
    expect(r.files).toEqual([png]);
  });

  it('drops the image to url + text when no image can ride along with the link', () => {
    const gif = file('a.gif');
    /* platform refuses any payload that carries files */
    expect(chooseShare(TEXT, URL, [gif], (d) => !d.files)).toEqual({ text: TEXT, url: URL });
  });

  it('returns url + text when there is no image at all', () => {
    expect(chooseShare(TEXT, URL, [], () => true)).toEqual({ text: TEXT, url: URL });
  });

  it('never keeps an image without the url (the link is mandatory)', () => {
    const gif = file('a.gif');
    /* a platform that takes files+text but rejects the url field -> link wins */
    const r = chooseShare(TEXT, URL, [gif], (d) => !d.url);
    expect(r).toEqual({ text: TEXT, url: URL });
  });
});

describe('planShare', () => {
  it('shares image + url + text through the share API when it accepts them', () => {
    const gif = file('a.gif');
    expect(planShare(TEXT, URL, [gif], true, () => true))
      .toEqual({ kind: 'share', payload: { text: TEXT, url: URL, files: [gif] } });
  });

  it('shares url + text (image dropped) when the share API refuses the image', () => {
    const gif = file('a.gif');
    expect(planShare(TEXT, URL, [gif], true, (d) => !d.files))
      .toEqual({ kind: 'share', payload: { text: TEXT, url: URL } });
  });

  it('copies url + text ONLY when there is no share API — never a file download', () => {
    const gif = file('a.gif');
    expect(planShare(TEXT, URL, [gif], false, () => true))
      .toEqual({ kind: 'copy', text: TEXT + ' ' + URL });
  });
});
