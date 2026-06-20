/* The Web Share payload decision, pure and capability-driven.

   Product rule: a Share tap should hand the platform the picture AND the link
   AND the text all at once. But some share targets refuse a files+url+text
   payload (the Web Share API only promises what navigator.canShare() reports).
   When all three cannot travel together, the LINK wins: we drop the image and
   share url + text, never an image that has no tappable way back to the game. */

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
