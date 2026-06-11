/* fields/portal.ts - beamer/swirl: a glowing two-arm vortex. */
import { C } from '../lib/palette';
import type { FieldFn } from '../lib/types';

export const portal: FieldFn = (ctx, o) => {
  const px = o.px, py = o.py, cell = o.cell, now = o.now;
  ctx.save(); ctx.translate(px, py);
  const g = ctx.createRadialGradient(0, 0, cell * 0.03, 0, 0, cell * 0.36);
  g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(0.5, 'rgba(166,219,255,0.5)'); g.addColorStop(1, 'rgba(166,219,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, cell * 0.36, 0, 7); ctx.fill();
  ctx.rotate(now * 0.0022);
  ctx.strokeStyle = C.portalLn; ctx.lineWidth = Math.max(2.5, cell * 0.058); ctx.lineCap = 'round';
  for (let a = 0; a < 2; a++) {
    ctx.beginPath();
    for (let t = 0; t < Math.PI * 1.6; t += 0.2) {
      const rr = cell * 0.05 + t * cell * 0.075, ang = t + a * Math.PI;
      const xx = Math.cos(ang) * rr, yy = Math.sin(ang) * rr;
      if (t === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.fillStyle = C.portalHi; ctx.beginPath(); ctx.arc(0, 0, cell * 0.05, 0, 7); ctx.fill();
  ctx.restore();
};
