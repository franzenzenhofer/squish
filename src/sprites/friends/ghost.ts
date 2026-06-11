/* sprites/friends/ghost.ts — a friendly floating ghost. (bonus friend) */
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const ghost: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  const sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  const bob = (o.idle !== false) ? U.bob(now, seed, 3) : 0;
  U.ground(ctx, x, y + r * 1.18, r * 0.7, 0.1);
  ctx.save(); ctx.translate(x, y + bob);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#EFEAF6');
  ctx.fillStyle = g; ctx.strokeStyle = '#D8D0E4'; ctx.lineWidth = Math.max(2, r * 0.07); ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.55);
  ctx.lineTo(-r, 0);
  ctx.arc(0, 0, r, Math.PI, 0, false);
  ctx.lineTo(r, r * 0.55);
  ctx.quadraticCurveTo(r * 0.66, r * 0.9, r * 0.33, r * 0.55);
  ctx.quadraticCurveTo(0, r * 0.9, -r * 0.33, r * 0.55);
  ctx.quadraticCurveTo(-r * 0.66, r * 0.9, -r, r * 0.55);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.42, r * 0.22, r * 0.12, -0.5, 0, 7); ctx.fill();
  U.blush(ctx, r, { y: 0.16, spread: 0.5 });
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.08, size: 0.16, spacing: 0.32 });
  U.mouth(ctx, r, { mood: mood === 'joy' ? 'joy' : 'o', dx, y: 0.22 });
  ctx.restore();
};
