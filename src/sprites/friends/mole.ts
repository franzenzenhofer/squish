/* sprites/friends/mole.ts — a mocha mole who tunnels edge to edge. (mover friend) */
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const mole: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.03); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#DDC2B0', base: '#A8826B', lo: '#8A6450', line: '#6C4B3B', core: '#C49C84' };
  const sniff = 1 + Math.sin(now * 0.008 + seed) * 0.14;
  U.ground(ctx, x, y + r * 0.98, r * 0.92);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  /* digging paws with little claws */
  ctx.fillStyle = col.lo; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.06); ctx.lineJoin = 'round';
  [-1, 1].forEach((s) => {
    ctx.save(); ctx.translate(s * r * 0.52, r * 0.76); ctx.rotate(s * 0.3);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.28, r * 0.19, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.lineWidth = Math.max(1.2, r * 0.03);
    [-0.4, 0, 0.4].forEach((cy) => { ctx.beginPath(); ctx.moveTo(s * r * 0.18, cy * r * 0.16); ctx.lineTo(s * r * 0.32, cy * r * 0.16); ctx.stroke(); });
    ctx.restore();
  });
  U.plush(ctx, r, col);
  U.blush(ctx, r, { y: 0.34, spread: 0.62, w: 0.2, h: 0.13, alpha: 0.6 });
  /* big open sparkly eyes */
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.04, size: 0.18, spacing: 0.3 });
  /* big shiny pink nose — the star of the show, sniffing */
  ctx.save(); ctx.translate(0, r * 0.22); ctx.scale(sniff, sniff);
  const ng = ctx.createRadialGradient(-r * 0.05, -r * 0.05, r * 0.02, 0, 0, r * 0.24);
  ng.addColorStop(0, '#FFC2D6'); ng.addColorStop(1, '#FF7FA8');
  ctx.fillStyle = ng; ctx.strokeStyle = '#E2658F'; ctx.lineWidth = Math.max(1.4, r * 0.035);
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.18, r * 0.15, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(-r * 0.06, -r * 0.05, r * 0.045, 0, 7); ctx.fill();
  ctx.restore();
  /* whiskers */
  ctx.strokeStyle = 'rgba(120,90,120,0.45)'; ctx.lineWidth = Math.max(1, r * 0.022); ctx.lineCap = 'round';
  [-1, 1].forEach((s) => { ctx.beginPath(); ctx.moveTo(s * r * 0.14, r * 0.42); ctx.lineTo(s * r * 0.64, r * 0.36); ctx.stroke(); });
  U.sparkle(ctx, r * 0.68, -r * 0.56, r * 0.11, '#FFF1E6');
  ctx.restore();
};
