/* sprites/friends/penguin.ts — a tubby penguin. (bonus friend) */
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const penguin: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.03); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#C3CDEC', base: '#9AA7D8', lo: '#7E8DC8', line: '#6373B4', core: '#8C9BD2' };
  U.ground(ctx, x, y + r * 0.98, r * 0.92);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  ctx.fillStyle = '#FF9F45'; ctx.strokeStyle = '#E5872E'; ctx.lineWidth = Math.max(1.5, r * 0.05);
  [-0.3, 0.3].forEach((fx) => { ctx.beginPath(); ctx.ellipse(r * fx, r * 0.95, r * 0.18, r * 0.09, 0, 0, 7); ctx.fill(); ctx.stroke(); });
  U.plush(ctx, r, col);
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.ellipse(0, r * 0.2, r * 0.52, r * 0.62, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#FF9F45'; ctx.strokeStyle = '#E5872E'; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 0.1, r * 0.02); ctx.lineTo(r * 0.1, r * 0.02); ctx.lineTo(0, r * 0.16); ctx.closePath(); ctx.fill(); ctx.stroke();
  U.blush(ctx, r, { y: 0.16, spread: 0.6, color: '#9FB0E2' });
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.18, size: 0.14, spacing: 0.28 });
  ctx.restore();
};
