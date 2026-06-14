/* sprites/friends/mouse.ts — a timid dove-grey mouse who scurries away. (mover friend) */
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const mouse: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  let mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.035); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#EDEDF2', base: '#C7C8D2', lo: '#A9AAB8', line: '#8C8D9E', core: '#D9DAE2' };
  const tw = Math.sin(now * 0.007 + seed) * 0.1;
  if (mood === 'happy' && o.idle !== false && !dx && !dy && U.beat(now, seed, 6000, 700)) mood = 'worried';
  U.ground(ctx, x, y + r * 0.98, r * 0.9);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  [-1, 1].forEach((s) => {
    ctx.save(); ctx.translate(s * r * 0.66, -r * 0.66); ctx.rotate(s * tw);
    ctx.fillStyle = col.lo; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFC8DC'; ctx.beginPath(); ctx.arc(0, r * 0.04, r * 0.24, 0, 7); ctx.fill();
    ctx.restore();
  });
  U.plush(ctx, r, col);
  U.blush(ctx, r, { y: 0.28, spread: 0.62 });
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.02, size: 0.15, spacing: 0.32 });
  ctx.fillStyle = '#FF9CBE'; ctx.beginPath(); ctx.ellipse(0, r * 0.2, r * 0.05, r * 0.04, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(120,90,120,0.5)'; ctx.lineWidth = Math.max(1, r * 0.022); ctx.lineCap = 'round';
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s * r * 0.08, r * 0.2); ctx.lineTo(s * r * 0.6, r * 0.12);
    ctx.moveTo(s * r * 0.08, r * 0.24); ctx.lineTo(s * r * 0.6, r * 0.26);
    ctx.stroke();
  });
  ctx.restore();
};
