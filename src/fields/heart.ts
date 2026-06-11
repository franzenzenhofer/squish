/* fields/heart — the goal: a glossy heart with a soft glow ring, gentle
   beat, and two sparkles orbiting it. o.won fills it in. */
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { FieldFn } from '../lib/types';

export const heart: FieldFn = (ctx, o) => {
  const px = o.px, py = o.py, cell = o.cell, now = o.now, won = o.won;
  const hp = 1 + 0.06 * Math.sin(now * 0.004);
  const g = ctx.createRadialGradient(px, py, cell * 0.1, px, py, cell * 0.46);
  g.addColorStop(0, 'rgba(255,107,157,0.2)'); g.addColorStop(1, 'rgba(255,107,157,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, cell * 0.46, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(px, py); ctx.scale(hp, hp);
  if (won) {
    const fg = ctx.createRadialGradient(-cell * 0.1, -cell * 0.14, cell * 0.04, 0, 0, cell * 0.42);
    fg.addColorStop(0, C.heartHi); fg.addColorStop(1, C.heart);
    ctx.fillStyle = fg; U.heart(ctx, 0, 0, cell * 0.32); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,107,157,0.14)'; U.heart(ctx, 0, 0, cell * 0.32); ctx.fill();
  }
  ctx.strokeStyle = C.heart; ctx.lineWidth = Math.max(3, cell * 0.075); ctx.lineJoin = 'round';
  U.heart(ctx, 0, 0, cell * 0.32); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(-cell * 0.1, -cell * 0.06, cell * 0.06, cell * 0.04, -0.6, 0, 7); ctx.fill();
  ctx.restore();
  for (let i = 0; i < 2; i++) {
    const a = now * 0.0014 + i * Math.PI + (px + py);
    U.sparkle(ctx, px + Math.cos(a) * cell * 0.42, py + Math.sin(a) * cell * 0.42, cell * 0.05, C.heartHi);
  }
};
