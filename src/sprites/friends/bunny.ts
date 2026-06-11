/* sprites/friends/bunny.ts — a cream bunny with tall ears. (bonus friend) */
import { C } from '../../lib/palette';
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const bunny: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now || 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.03); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#FFFFFF', base: '#FFF6FB', lo: '#F1E1EC', line: '#E2C2D5', core: '#F8EAF2' };
  U.ground(ctx, x, y + r * 0.98, r * 0.9);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  ([[-0.32, -1.12, -0.13], [0.32, -1.12, 0.13]] as const).forEach(([px, py, rot]) => {
    ctx.save(); ctx.translate(r * px, r * py); ctx.rotate(rot);
    ctx.fillStyle = col.lo; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.16, r * 0.56, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFC8DC'; ctx.beginPath(); ctx.ellipse(0, r * 0.06, r * 0.08, r * 0.42, 0, 0, 7); ctx.fill();
    ctx.restore();
  });
  U.plush(ctx, r, col);
  U.blush(ctx, r, { spread: 0.56 });
  U.eyes(ctx, r, { dx, dy, mood, seed, now, size: 0.16 });
  ctx.fillStyle = '#FF9CBE';
  ctx.beginPath(); ctx.moveTo(0, r * 0.2); ctx.lineTo(-r * 0.06, r * 0.13); ctx.lineTo(r * 0.06, r * 0.13); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(1.4, r * 0.045); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.2); ctx.lineTo(0, r * 0.26);
  ctx.moveTo(0, r * 0.26); ctx.quadraticCurveTo(-r * 0.07, r * 0.33, -r * 0.12, r * 0.27);
  ctx.moveTo(0, r * 0.26); ctx.quadraticCurveTo(r * 0.07, r * 0.33, r * 0.12, r * 0.27);
  ctx.stroke();
  ctx.restore();
};
