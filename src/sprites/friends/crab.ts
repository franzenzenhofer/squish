/* sprites/friends/crab.ts — a tomato-red crab with big snapping claws. (mover friend) */
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const crab: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.03); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#FFC2B2', base: '#FF7E63', lo: '#F0603F', line: '#D2462A', core: '#FB6E4D' };
  const open = 0.18 + Math.abs(Math.sin(now * 0.004 + seed)) * 0.3;
  U.ground(ctx, x, y + r * 0.98, r);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  /* three little legs each side */
  ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.07);
  [-1, 1].forEach((s) => {
    [0.34, 0.54, 0.72].forEach((ly, i) => {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.66, r * ly);
      ctx.quadraticCurveTo(s * r * (1.0 + i * 0.06), r * (ly - 0.02), s * r * (1.04 + i * 0.06), r * (ly + 0.16));
      ctx.stroke();
    });
  });
  /* arms + big pincer claws raised beside the head, snapping open/closed */
  [-1, 1].forEach((s) => {
    ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(3, r * 0.11);
    ctx.beginPath(); ctx.moveTo(s * r * 0.6, r * 0.06); ctx.quadraticCurveTo(s * r * 1.0, -r * 0.05, s * r * 1.0, -r * 0.34); ctx.stroke();
    ctx.save(); ctx.translate(s * r * 1.0, -r * 0.4);
    ctx.fillStyle = col.base; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.save(); ctx.rotate(s * 0.12); ctx.beginPath(); ctx.ellipse(s * r * 0.1, r * 0.12, r * 0.3, r * 0.18, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.rotate(s * (-0.12 - open)); ctx.beginPath(); ctx.ellipse(s * r * 0.1, -r * 0.12, r * 0.3, r * 0.18, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.restore();
  });
  U.plush(ctx, r, col);
  /* tiny eyestalk nubs on top */
  [-1, 1].forEach((s) => {
    ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(1.6, r * 0.05);
    ctx.beginPath(); ctx.moveTo(s * r * 0.22, -r * 0.78); ctx.lineTo(s * r * 0.24, -r * 1.0); ctx.stroke();
    ctx.fillStyle = col.lo; ctx.beginPath(); ctx.arc(s * r * 0.24, -r * 1.04, r * 0.08, 0, 7); ctx.fill();
  });
  U.blush(ctx, r, { y: 0.28, spread: 0.62, w: 0.2, h: 0.13, alpha: 0.6 });
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.02, size: 0.19, spacing: 0.34 });
  U.mouth(ctx, r, { mood: mood === 'joy' ? 'joy' : 'cat', dx, y: 0.3 });
  U.sparkle(ctx, -r * 0.66, -r * 0.5, r * 0.11, '#FFE8DF');
  ctx.restore();
};
