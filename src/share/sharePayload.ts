/* The Web Share payload decision, pure and capability-driven.

   Product rule: a Share tap should hand the platform the picture AND the link
   AND the text all at once. But some share targets refuse a files+url+text
   payload (the Web Share API only promises what navigator.canShare() reports).
   When all three cannot travel together, the LINK wins: we drop the image and
   share url + text, never an image that has no tappable way back to the game. */

/** Whether to hand a share off to the OS share sheet at all. Only when the
    platform exposes one AND the primary pointer is coarse (a touch device). On a
    desktop (fine pointer) the OS sheet serialises a shared file into the "Copy"
    action as a local file path - producing a useless, unsendable link - so there
    we skip the sheet and copy a clean link instead. The link matters more than
    the picture; the picture is a bonus only where it travels well (e.g. WhatsApp
    on a phone). */
export function preferShareSheet(hasShareApi: boolean, coarsePointer: boolean): boolean {
  return hasShareApi && coarsePointer;
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
