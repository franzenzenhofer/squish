export function ensureCanvasSize(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  syncCss = false
): void {
  const width = Math.round(cssWidth * dpr);
  const height = Math.round(cssHeight * dpr);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  if (!syncCss) return;
  const styleWidth = cssWidth + 'px';
  const styleHeight = cssHeight + 'px';
  if (canvas.style.width !== styleWidth) canvas.style.width = styleWidth;
  if (canvas.style.height !== styleHeight) canvas.style.height = styleHeight;
}
