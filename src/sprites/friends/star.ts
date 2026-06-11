/* sprites/friends/star.ts — a twinkly star buddy. (bonus friend) */
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const star: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.32;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.035); sx *= br.sx; sy *= br.sy; }
  U.ground(ctx, x, y + r * 0.86, r * 0.85);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.rotate(Math.sin(now * 0.001 + seed) * 0.07);
  ctx.scale(sx, sy);
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, '#FFE493'); g.addColorStop(1, '#FBC548');
  ctx.fillStyle = g; ctx.strokeStyle = '#E9A92E'; ctx.lineWidth = Math.max(2, r * 0.08); ctx.lineJoin = 'round';
  U.star5(ctx, 0, 0, r * 1.15, r * 0.52); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.3, r * 0.18, r * 0.1, -0.5, 0, 7); ctx.fill();
  U.blush(ctx, r * 0.85, { y: 0.32, spread: 0.55 });
  U.eyes(ctx, r * 0.85, { dx, dy, mood, seed, now, eyeY: 0.04, size: 0.16, spacing: 0.3 });
  U.mouth(ctx, r * 0.85, { mood: mood === 'joy' ? 'joy' : (mood === 'dizzy' ? 'o' : 'smile'), dx, y: 0.34 });
  ctx.restore();
};
