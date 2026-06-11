/* sprites/friends/chick.ts — a fluffy yellow chick. (bonus friend) */
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const chick: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.035); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#FFF3C8', base: '#FFE08A', lo: '#FBCD54', line: '#ECB23E', core: '#FFD873' };
  U.ground(ctx, x, y + r * 0.98, r * 0.9);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.06); ctx.lineCap = 'round';
  [-0.16, 0, 0.16].forEach((a) => { ctx.save(); ctx.translate(0, -r * 0.95); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.22); ctx.stroke(); ctx.restore(); });
  ctx.fillStyle = col.lo; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.beginPath(); ctx.ellipse(-r * 0.92, r * 0.12, r * 0.18, r * 0.28, 0.3, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(r * 0.92, r * 0.12, r * 0.18, r * 0.28, -0.3, 0, 7); ctx.fill(); ctx.stroke();
  U.plush(ctx, r, col);
  ctx.fillStyle = '#FF9F45'; ctx.strokeStyle = '#E5872E'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.12, r * 0.18); ctx.lineTo(r * 0.12, r * 0.18); ctx.lineTo(0, r * 0.32); ctx.closePath(); ctx.fill(); ctx.stroke();
  U.blush(ctx, r, { y: 0.2, spread: 0.62 });
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.14, size: 0.15, spacing: 0.32 });
  ctx.restore();
};
