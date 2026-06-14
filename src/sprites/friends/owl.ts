/* sprites/friends/owl.ts — a lilac owl, wide awake while the panda sleeps. (mover friend) */
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const owl: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.028); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#C8F0EA', base: '#8AD6CD', lo: '#5FBDB2', line: '#46A89C', core: '#A6E2DA' };
  const tuft = Math.sin(now * 0.004 + seed) * 0.08;
  U.ground(ctx, x, y + r * 0.98, r * 0.9);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  ctx.fillStyle = col.lo; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.06); ctx.lineJoin = 'round';
  [-1, 1].forEach((s) => {
    ctx.save(); ctx.rotate(s * (0.12 + tuft));
    ctx.beginPath(); ctx.moveTo(s * r * 0.42, -r * 0.7); ctx.lineTo(s * r * 0.66, -r * 1.12); ctx.lineTo(s * r * 0.14, -r * 0.86); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  });
  U.plush(ctx, r, col);
  ctx.fillStyle = '#EAFBF8'; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(1.6, r * 0.045);
  [-1, 1].forEach((s) => { ctx.beginPath(); ctx.arc(s * r * 0.32, -r * 0.06, r * 0.34, 0, 7); ctx.fill(); ctx.stroke(); });
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.06, size: 0.2, spacing: 0.32 });
  ctx.fillStyle = '#F4B45A'; ctx.strokeStyle = '#E0982F'; ctx.lineWidth = Math.max(1.2, r * 0.03);
  ctx.beginPath(); ctx.moveTo(0, r * 0.08); ctx.lineTo(-r * 0.1, r * 0.2); ctx.lineTo(r * 0.1, r * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  U.blush(ctx, r, { y: 0.18, spread: 0.74 });
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1, r * 0.03);
  [0.22, 0.4].forEach((ty) => { ctx.beginPath(); ctx.arc(0, r * ty, r * 0.16, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke(); });
  ctx.restore();
};
