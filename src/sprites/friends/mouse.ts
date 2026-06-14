/* sprites/friends/mouse.ts — a timid cool-grey mouse who scurries away. (mover friend) */
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const mouse: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  let mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.035); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#EFEFF4', base: '#CBCCD6', lo: '#ADAEBC', line: '#8C8D9E', core: '#DCDDE4' };
  const tw = Math.sin(now * 0.007 + seed) * 0.1;
  if (mood === 'happy' && o.idle !== false && !dx && !dy && U.beat(now, seed, 6000, 700)) mood = 'worried';
  U.ground(ctx, x, y + r * 0.98, r * 0.9);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  /* two big round ears, pink inner */
  [-1, 1].forEach((s) => {
    ctx.save(); ctx.translate(s * r * 0.64, -r * 0.7); ctx.rotate(s * tw);
    ctx.fillStyle = col.lo; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.46, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFC4DC'; ctx.beginPath(); ctx.arc(0, r * 0.05, r * 0.27, 0, 7); ctx.fill();
    ctx.restore();
  });
  U.plush(ctx, r, col);
  U.blush(ctx, r, { y: 0.3, spread: 0.62, w: 0.2, h: 0.13, alpha: 0.6 });
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.02, size: 0.19, spacing: 0.34 });
  ctx.fillStyle = '#FF8FB4'; ctx.beginPath(); ctx.ellipse(0, r * 0.24, r * 0.055, r * 0.045, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(120,90,120,0.5)'; ctx.lineWidth = Math.max(1, r * 0.022); ctx.lineCap = 'round';
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(s * r * 0.08, r * 0.24); ctx.lineTo(s * r * 0.62, r * 0.16);
    ctx.moveTo(s * r * 0.08, r * 0.28); ctx.lineTo(s * r * 0.62, r * 0.3);
    ctx.stroke();
  });
  U.sparkle(ctx, r * 0.7, -r * 0.5, r * 0.11, '#FFFFFF');
  ctx.restore();
};
