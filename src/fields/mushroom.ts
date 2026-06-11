/* fields/mushroom.ts - BOUNCE (new concept: a springy coil that goes boing!).
   A stack of coil rings topped by a smiley dome that bobs up and down and
   opens its mouth on the way up. */
import { C } from '../lib/palette';
import type { FieldFn } from '../lib/types';

export const mushroom: FieldFn = (ctx, o) => {
  const px = o.px, py = o.py, cell = o.cell, now = o.now;
  const gx = o.gx ?? 0, gy = o.gy ?? 0;
  ctx.save(); ctx.translate(px, py);

  const comp = 0.5 + 0.5 * Math.sin(now * 0.005 + gx * 1.3 + gy);  // 0..1 expansion
  const baseY = cell * 0.34;
  const topY = -cell * 0.16 - comp * cell * 0.08;
  const rw = cell * 0.24;

  /* coil rings, bottom to top */
  const rings = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < rings; i++) {
    const f = i / (rings - 1);
    const yy = baseY + (topY - baseY) * f;
    ctx.strokeStyle = i % 2 ? C.curl : C.curlLn;
    ctx.lineWidth = Math.max(2.5, cell * 0.075);
    ctx.beginPath(); ctx.ellipse(0, yy, rw, cell * 0.075, 0, 0, Math.PI * 2); ctx.stroke();
  }

  /* domed head */
  const capY = topY - cell * 0.05;
  const dg = ctx.createRadialGradient(-cell * 0.08, capY - cell * 0.07, cell * 0.02, 0, capY, cell * 0.3);
  dg.addColorStop(0, C.curlHi); dg.addColorStop(1, C.curl);
  ctx.fillStyle = dg; ctx.strokeStyle = C.curlLn; ctx.lineWidth = Math.max(2, cell * 0.04);
  ctx.beginPath(); ctx.ellipse(0, capY, rw * 1.08, cell * 0.21, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(-cell * 0.07, capY - cell * 0.08, cell * 0.08, cell * 0.04, -0.4, 0, 7); ctx.fill();

  /* face */
  ctx.fillStyle = C.pupil;
  ctx.beginPath(); ctx.arc(-cell * 0.06, capY - cell * 0.01, cell * 0.026, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cell * 0.06, capY - cell * 0.01, cell * 0.026, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-cell * 0.07, capY - cell * 0.02, cell * 0.009, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cell * 0.05, capY - cell * 0.02, cell * 0.009, 0, 7); ctx.fill();
  ctx.fillStyle = C.pupil;
  const mo = 0.3 + 0.7 * comp;
  ctx.beginPath(); ctx.ellipse(0, capY + cell * 0.07, cell * 0.028, cell * 0.04 * mo, 0, 0, 7); ctx.fill();
  ctx.fillStyle = C.blush; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.arc(-cell * 0.15, capY + cell * 0.04, cell * 0.035, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cell * 0.15, capY + cell * 0.04, cell * 0.035, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
};
