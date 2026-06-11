/* fields/honey — STICKY (new concept: a little smiley flower).
   You land in its soft petals and stay put. Sways & breathes gently. */
import { C } from '../lib/palette';
import type { FieldFn } from '../lib/types';

export const honey: FieldFn = (ctx, o) => {
  const px = o.px, py = o.py, cell = o.cell, now = o.now;
  const gx = o.gx ?? 0, gy = o.gy ?? 0;
  ctx.save(); ctx.translate(px, py);
  const sw = 1 + 0.05 * Math.sin(now * 0.004 + gx + gy);
  ctx.scale(sw, sw);
  ctx.rotate(Math.sin(now * 0.0013 + gx) * 0.08);

  /* 6 petals */
  const pr = cell * 0.17, ring = cell * 0.2;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const pxx = Math.cos(a) * ring, pyy = Math.sin(a) * ring;
    const pg = ctx.createRadialGradient(pxx, pyy, pr * 0.2, pxx, pyy, pr * 1.35);
    pg.addColorStop(0, C.bibiHi); pg.addColorStop(1, C.bibi);
    ctx.fillStyle = pg; ctx.strokeStyle = C.bibiLn; ctx.lineWidth = Math.max(1.5, cell * 0.02);
    ctx.beginPath(); ctx.ellipse(pxx, pyy, pr, pr * 1.35, a, 0, 7); ctx.fill(); ctx.stroke();
  }

  /* sunny center */
  const cg = ctx.createRadialGradient(-cell * 0.04, -cell * 0.05, cell * 0.02, 0, 0, cell * 0.18);
  cg.addColorStop(0, C.honeyHi); cg.addColorStop(1, C.yel);
  ctx.fillStyle = cg; ctx.strokeStyle = C.honeyLn; ctx.lineWidth = Math.max(1.5, cell * 0.02);
  ctx.beginPath(); ctx.arc(0, 0, cell * 0.15, 0, 7); ctx.fill(); ctx.stroke();

  /* tiny happy face */
  ctx.fillStyle = C.pupil;
  ctx.beginPath(); ctx.arc(-cell * 0.05, -cell * 0.01, cell * 0.022, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cell * 0.05, -cell * 0.01, cell * 0.022, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-cell * 0.058, -cell * 0.016, cell * 0.008, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cell * 0.042, -cell * 0.016, cell * 0.008, 0, 7); ctx.fill();
  ctx.strokeStyle = C.pupil; ctx.lineWidth = Math.max(1, cell * 0.015); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, cell * 0.02, cell * 0.035, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();

  ctx.restore();
};
