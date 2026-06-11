/* fields/jelly — hop: a wobbly translucent gummy dome with a tiny smiley. */
import { C } from '../lib/palette';
import type { FieldFn } from '../lib/types';

export const jelly: FieldFn = (ctx, o) => {
  const px = o.px, py = o.py, cell = o.cell, now = o.now;
  const gx = o.gx ?? 0, gy = o.gy ?? 0;
  ctx.save(); ctx.translate(px, py);
  const wob = 1 + 0.08 * Math.sin(now * 0.005 + gx * 2 + gy); ctx.scale(wob, 1 / wob);
  const jg = ctx.createLinearGradient(0, -cell * 0.3, 0, cell * 0.24);
  jg.addColorStop(0, C.jellyHi); jg.addColorStop(1, C.jelly);
  ctx.fillStyle = jg; ctx.strokeStyle = C.jellyLn; ctx.lineWidth = 2; ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.moveTo(-cell * 0.3, cell * 0.22);
  ctx.quadraticCurveTo(-cell * 0.34, -cell * 0.32, 0, -cell * 0.32);
  ctx.quadraticCurveTo(cell * 0.34, -cell * 0.32, cell * 0.3, cell * 0.22);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath(); ctx.ellipse(-cell * 0.1, -cell * 0.13, cell * 0.09, cell * 0.06, -0.5, 0, 7); ctx.fill();
  ctx.fillStyle = C.pupil;
  ctx.beginPath(); ctx.arc(-cell * 0.07, -cell * 0.02, cell * 0.025, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cell * 0.07, -cell * 0.02, cell * 0.025, 0, 7); ctx.fill();
  ctx.strokeStyle = C.pupil; ctx.lineWidth = Math.max(1.2, cell * 0.018); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, cell * 0.04, cell * 0.04, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  ctx.restore();
};
