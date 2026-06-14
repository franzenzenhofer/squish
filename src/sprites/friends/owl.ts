/* sprites/friends/owl.ts — a teal owl, wide awake while the panda sleeps. (mover friend) */
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const owl: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.028); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#CCF2EC', base: '#86D6CD', lo: '#5BBBB0', line: '#43A599', core: '#A6E2DA' };
  const tuft = Math.sin(now * 0.004 + seed) * 0.08;
  U.ground(ctx, x, y + r * 0.98, r * 0.9);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  ctx.fillStyle = col.lo; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.06); ctx.lineJoin = 'round';
  [-1, 1].forEach((s) => {
    ctx.save(); ctx.rotate(s * (0.12 + tuft));
    ctx.beginPath(); ctx.moveTo(s * r * 0.44, -r * 0.66); ctx.lineTo(s * r * 0.66, -r * 1.14); ctx.lineTo(s * r * 0.12, -r * 0.84); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  });
  U.plush(ctx, r, col);
  /* big pale facial discs — owl's signature */
  ctx.fillStyle = '#ECFCF9'; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(1.6, r * 0.045);
  [-1, 1].forEach((s) => { ctx.beginPath(); ctx.arc(s * r * 0.34, -r * 0.04, r * 0.37, 0, 7); ctx.fill(); ctx.stroke(); });
  U.blush(ctx, r, { y: 0.22, spread: 0.8, w: 0.17, h: 0.12, alpha: 0.55 });
  /* the biggest glossy eyes in the whole game */
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.04, size: 0.22, spacing: 0.34 });
  ctx.fillStyle = '#F4B45A'; ctx.strokeStyle = '#E0982F'; ctx.lineWidth = Math.max(1.2, r * 0.03);
  ctx.beginPath(); ctx.moveTo(0, r * 0.1); ctx.lineTo(-r * 0.1, r * 0.22); ctx.lineTo(r * 0.1, r * 0.22); ctx.closePath(); ctx.fill(); ctx.stroke();
  U.sparkle(ctx, r * 0.74, -r * 0.5, r * 0.12, '#EAFFFB');
  ctx.restore();
};
