/* sprites/friends/cat.ts — a lilac kitty with whiskers. (bonus friend) */
import { C } from '../../lib/palette';
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const cat: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now || 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.03); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#F4EFFC', base: '#E5DDF4', lo: '#D0C4EA', line: '#B7A6DE', core: '#DBD0F0' };
  U.ground(ctx, x, y + r * 0.98, r * 0.9);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  ctx.fillStyle = col.lo; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.07); ctx.lineJoin = 'round';
  [-1, 1].forEach((s2) => {
    ctx.beginPath(); ctx.moveTo(s2 * r * 0.5, -r * 0.52); ctx.lineTo(s2 * r * 0.82, -r * 1.06); ctx.lineTo(s2 * r * 0.16, -r * 0.78); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFC8DC'; ctx.beginPath(); ctx.moveTo(s2 * r * 0.48, -r * 0.58); ctx.lineTo(s2 * r * 0.66, -r * 0.92); ctx.lineTo(s2 * r * 0.3, -r * 0.74); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col.lo;
  });
  U.plush(ctx, r, col);
  U.blush(ctx, r, { y: 0.28, spread: 0.62 });
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.04, size: 0.15, spacing: 0.34 });
  ctx.fillStyle = '#FF9CBE'; ctx.beginPath(); ctx.moveTo(0, r * 0.22); ctx.lineTo(-r * 0.05, r * 0.16); ctx.lineTo(r * 0.05, r * 0.16); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(1.4, r * 0.04); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.22); ctx.lineTo(0, r * 0.27);
  ctx.moveTo(0, r * 0.27); ctx.quadraticCurveTo(-r * 0.06, r * 0.33, -r * 0.11, r * 0.28);
  ctx.moveTo(0, r * 0.27); ctx.quadraticCurveTo(r * 0.06, r * 0.33, r * 0.11, r * 0.28);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,90,120,0.5)'; ctx.lineWidth = Math.max(1, r * 0.025);
  [-1, 1].forEach((s2) => {
    ctx.beginPath();
    ctx.moveTo(s2 * r * 0.4, r * 0.16); ctx.lineTo(s2 * r * 0.85, r * 0.1);
    ctx.moveTo(s2 * r * 0.4, r * 0.24); ctx.lineTo(s2 * r * 0.85, r * 0.24);
    ctx.stroke();
  });
  ctx.restore();
};
