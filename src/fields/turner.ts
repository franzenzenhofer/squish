/* fields/turner.ts — curl: a clockwise arrow on a soft disc that rocks
   gently. */
import { C } from '../lib/palette';
import type { FieldFn } from '../lib/types';

export const turner: FieldFn = (ctx, o) => {
  const px = o.px, py = o.py, cell = o.cell, now = o.now;
  ctx.save(); ctx.translate(px, py);
  ctx.fillStyle = 'rgba(196,169,248,0.25)';
  ctx.beginPath(); ctx.arc(0, 0, cell * 0.32, 0, 7); ctx.fill();
  ctx.rotate(Math.sin(now * 0.002) * 0.15);
  ctx.strokeStyle = C.curl; ctx.lineWidth = Math.max(2.6, cell * 0.085); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, cell * 0.17, -Math.PI * 0.55, Math.PI * 0.85); ctx.stroke();
  const aa = Math.PI * 0.85;
  ctx.fillStyle = C.curl;
  ctx.save(); ctx.translate(Math.cos(aa) * cell * 0.17, Math.sin(aa) * cell * 0.17); ctx.rotate(aa + Math.PI * 0.5);
  ctx.beginPath(); ctx.moveTo(cell * 0.11, 0); ctx.lineTo(-cell * 0.05, -cell * 0.085); ctx.lineTo(-cell * 0.05, cell * 0.085); ctx.closePath(); ctx.fill();
  ctx.restore(); ctx.restore();
};
