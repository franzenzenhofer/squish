/* sprites/friends/puppy.ts — a caramel puppy with floppy ears who follows you. (mover friend) */
import { C } from '../../lib/palette';
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const puppy: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.03); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#FBD9A8', base: '#E8A35C', lo: '#D4863E', line: '#B86C2C', core: '#F0BE7E' };
  const earc = '#C97F38';
  const flop = Math.sin(now * 0.0045 + seed) * 0.1;
  U.ground(ctx, x, y + r * 0.98, r * 0.95);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  /* long floppy ears hanging at the sides */
  ctx.fillStyle = earc; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.06); ctx.lineJoin = 'round';
  [-1, 1].forEach((s) => {
    ctx.save(); ctx.translate(s * r * 0.82, -r * 0.3); ctx.rotate(s * (0.32 + flop));
    ctx.beginPath(); ctx.ellipse(0, r * 0.44, r * 0.27, r * 0.56, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
  });
  U.plush(ctx, r, col);
  /* tan patch around one eye — classic puppy charm */
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
  ctx.fillStyle = earc; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.ellipse(-r * 0.36, -r * 0.06, r * 0.3, r * 0.34, 0.2, 0, 7); ctx.fill();
  ctx.restore();
  U.blush(ctx, r, { y: 0.34, spread: 0.66 });
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.04, size: 0.16, spacing: 0.34 });
  /* round nose with shine */
  ctx.fillStyle = C.pupil;
  ctx.beginPath(); ctx.ellipse(0, r * 0.18, r * 0.1, r * 0.08, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-r * 0.03, r * 0.15, r * 0.03, 0, 7); ctx.fill();
  /* puppy mouth (two little humps) + a small panting tongue */
  ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(1.5, r * 0.05); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.26); ctx.lineTo(0, r * 0.34);
  ctx.moveTo(0, r * 0.34); ctx.quadraticCurveTo(-r * 0.1, r * 0.42, -r * 0.17, r * 0.36);
  ctx.moveTo(0, r * 0.34); ctx.quadraticCurveTo(r * 0.1, r * 0.42, r * 0.17, r * 0.36);
  ctx.stroke();
  if (mood === 'joy' || U.beat(now, seed, 3000, 1100)) {
    ctx.fillStyle = C.tongue; ctx.strokeStyle = '#E2658F'; ctx.lineWidth = Math.max(1.2, r * 0.03);
    ctx.beginPath(); ctx.ellipse(0, r * 0.44, r * 0.07, r * 0.1, 0, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
};
