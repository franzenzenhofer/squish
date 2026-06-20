/* The Web Share payload decision, pure and capability-driven.

   Product rule: a Share tap should hand the platform the picture AND the link
   AND the text all at once. But some share targets refuse a files+url+text
   payload (the Web Share API only promises what navigator.canShare() reports).
   When all three cannot travel together, the LINK wins: we drop the image and
   share url + text, never an image that has no tappable way back to the game. */

/** The share message. The url is ALSO baked into the text (not only the separate
    url field) so the link rides inside the message body on any target that keeps
    the text but drops the url field. */
export function shareText(label: string, url: string): string {
  return 'Squishy & Friends ' + label + ' - Can you solve it? ' + url;
}

/** Pick the richest share payload this platform will actually accept. Tries each
    candidate image (best first) bundled with the url + text; if none can ride
    along with the link, returns just the url + text. */
export function chooseShare(
  text: string,
  url: string,
  files: File[],
  canShare: (data: ShareData) => boolean
): ShareData {
  for (const file of files) {
    const withImage: ShareData = { text, url, files: [file] };
    if (canShare(withImage)) return withImage;
  }
  return { text, url };
}

/** What a Share tap should do. The native Web Share API is ALWAYS used when the
    platform has one - it carries url + text + image (e.g. WhatsApp), or url +
    text where the image cannot ride along. The ONLY fallback, when there is no
    share API at all, is copying url + text to the clipboard. We never download a
    file and never bypass an available share sheet. */
export type ShareAction =
  | { kind: 'share'; payload: ShareData }
  | { kind: 'copy'; text: string };

export function planShare(
  text: string,
  url: string,
  files: File[],
  hasShareApi: boolean,
  canShare: (data: ShareData) => boolean
): ShareAction {
  /* text already carries the url (see shareText), so the copy fallback is just
     the message - no separate url to append, no duplication. */
  if (!hasShareApi) return { kind: 'copy', text };
  return { kind: 'share', payload: chooseShare(text, url, files, canShare) };
}
