/* sprites/friends/pig.ts — a round piggy. (bonus friend) */
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const pig: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.03); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#FFE3EE', base: '#FFC2D6', lo: '#FB9FBE', line: '#ED7CA0', core: '#FFB0CC' };
  U.ground(ctx, x, y + r * 0.98, r * 0.92);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  ctx.fillStyle = col.lo; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.07); ctx.lineJoin = 'round';
  [-1, 1].forEach((s2) => { ctx.beginPath(); ctx.moveTo(s2 * r * 0.42, -r * 0.5); ctx.lineTo(s2 * r * 0.72, -r * 0.82); ctx.lineTo(s2 * r * 0.74, -r * 0.42); ctx.closePath(); ctx.fill(); ctx.stroke(); });
  U.plush(ctx, r, col);
  ctx.fillStyle = '#FFB0CC'; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(1.5, r * 0.045);
  ctx.beginPath(); ctx.ellipse(0, r * 0.24, r * 0.26, r * 0.2, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col.line;
  ctx.beginPath(); ctx.ellipse(-r * 0.09, r * 0.24, r * 0.04, r * 0.06, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.09, r * 0.24, r * 0.04, r * 0.06, 0, 0, 7); ctx.fill();
  U.blush(ctx, r, { y: 0.3, spread: 0.68 });
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.1, size: 0.14, spacing: 0.34 });
  ctx.restore();
};
