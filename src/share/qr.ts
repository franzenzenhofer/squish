/* Offline QR rendering for a share URL. Uses qrcode-generator (tiny, zero-dep)
   to compute a module matrix, then paints it to a Canvas. No network, no secure
   context required — so this is the universal share path on every platform
   including the iOS app:// WKWebView. Auto QR version + EC level M; a 4-module
   quiet zone is always included (its absence is the top cause of unscannable
   codes). */

import qrcode from 'qrcode-generator';

const QUIET = 4;
const MIN_PX = 256;
const MIN_MODULE_PX = 4;

/** Pure: the QR as a square boolean grid (true = dark module). */
export function qrMatrix(text: string, ec: 'L' | 'M' | 'Q' | 'H' = 'M'): boolean[][] {
  const qr = qrcode(0, ec);
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const out: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    out.push(row);
  }
  return out;
}

/** Draw the QR to a canvas, sizing modules so the code is comfortably scannable. */
export function drawQr(
  canvas: HTMLCanvasElement,
  text: string,
  ec: 'L' | 'M' | 'Q' | 'H' = 'M'
): HTMLCanvasElement {
  const matrix = qrMatrix(text, ec);
  const n = matrix.length;
  const total = n + QUIET * 2;
  const px = Math.max(MIN_MODULE_PX, Math.ceil(MIN_PX / total));
  const size = total * px;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable for QR');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#1c1230';
  for (let r = 0; r < n; r++) {
    const row = matrix[r];
    if (!row) continue;
    for (let c = 0; c < n; c++) {
      if (row[c]) ctx.fillRect((c + QUIET) * px, (r + QUIET) * px, px, px);
    }
  }
  return canvas;
}
