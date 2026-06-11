/* sprites/friends/bear.ts — a caramel cub. (bonus friend, unused in game) */
import { C } from '../../lib/palette';
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const bear: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now || 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.03); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#F7E6CE', base: '#E8C9A0', lo: '#D6B184', line: '#C49863', core: '#DEBB8E' };
  U.ground(ctx, x, y + r * 0.98, r * 0.92);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  ctx.fillStyle = col.lo; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.08);
  ([[-0.62, -0.64], [0.62, -0.64]] as const).forEach(([px, py]) => { ctx.beginPath(); ctx.arc(r * px, r * py, r * 0.27, 0, 7); ctx.fill(); ctx.stroke(); });
  ctx.fillStyle = '#F3D9BE';
  ([[-0.62, -0.64], [0.62, -0.64]] as const).forEach(([px, py]) => { ctx.beginPath(); ctx.arc(r * px, r * py, r * 0.14, 0, 7); ctx.fill(); });
  U.plush(ctx, r, col);
  ctx.fillStyle = '#FBEFDD'; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.34, r * 0.26, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.line; ctx.beginPath(); ctx.ellipse(0, r * 0.17, r * 0.09, r * 0.07, 0, 0, 7); ctx.fill();
  U.blush(ctx, r, { y: 0.32, spread: 0.64 });
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.06, spacing: 0.34, size: 0.15 });
  ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(1.5, r * 0.045); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.24); ctx.lineTo(0, r * 0.31);
  ctx.moveTo(0, r * 0.31); ctx.quadraticCurveTo(-r * 0.08, r * 0.39, -r * 0.15, r * 0.33);
  ctx.moveTo(0, r * 0.31); ctx.quadraticCurveTo(r * 0.08, r * 0.39, r * 0.15, r * 0.33);
  ctx.stroke();
  ctx.restore();
};
