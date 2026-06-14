/* sprites/friends/mole.ts — a velvety mole who tunnels edge to edge. (mover friend) */
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const mole: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.03); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#D8BBA8', base: '#A8826B', lo: '#8C6651', line: '#6F4E3D', core: '#C49C84' };
  const sniff = 1 + Math.sin(now * 0.008 + seed) * 0.12;
  U.ground(ctx, x, y + r * 0.98, r * 0.92);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  ctx.fillStyle = col.lo; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.06); ctx.lineJoin = 'round';
  [-1, 1].forEach((s) => {
    ctx.save(); ctx.translate(s * r * 0.5, r * 0.74); ctx.rotate(s * 0.3);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.26, r * 0.18, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.lineWidth = Math.max(1.2, r * 0.03);
    [-0.4, 0, 0.4].forEach((cy) => { ctx.beginPath(); ctx.moveTo(s * r * 0.16, cy * r * 0.16); ctx.lineTo(s * r * 0.3, cy * r * 0.16); ctx.stroke(); });
    ctx.restore();
  });
  U.plush(ctx, r, col);
  U.blush(ctx, r, { y: 0.32, spread: 0.6 });
  U.eyes(ctx, r, { mood: mood === 'joy' ? 'joy' : 'sleepy', seed, now, eyeY: 0, size: 0.16, spacing: 0.3 });
  ctx.save(); ctx.translate(0, r * 0.2); ctx.scale(sniff, sniff);
  const ng = ctx.createRadialGradient(-r * 0.04, -r * 0.04, r * 0.02, 0, 0, r * 0.2);
  ng.addColorStop(0, '#FFB6CF'); ng.addColorStop(1, '#FF7FA8');
  ctx.fillStyle = ng; ctx.strokeStyle = '#E2658F'; ctx.lineWidth = Math.max(1.4, r * 0.035);
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.16, r * 0.13, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.04, r * 0.04, 0, 7); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(120,90,120,0.45)'; ctx.lineWidth = Math.max(1, r * 0.022); ctx.lineCap = 'round';
  [-1, 1].forEach((s) => { ctx.beginPath(); ctx.moveTo(s * r * 0.12, r * 0.36); ctx.lineTo(s * r * 0.62, r * 0.3); ctx.stroke(); });
  ctx.restore();
};
