/* sprites/friends/puppy.ts — a cute little puppy (dog-face icon) in our plush style. (mover friend) */
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
  const col = { hi: '#FFF0D2', base: '#F7D9A0', lo: '#EBC079', line: '#CC9C53', core: '#FCE6BB' };
  const ear = { hi: '#C5843C', lo: '#9A5F26', line: '#7A491C' };
  const flop = Math.sin(now * 0.005 + seed) * 0.04;
  U.ground(ctx, x, y + r * 0.98, r);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  /* big floppy ears: attached at the top corners, hanging down the outer sides */
  [-1, 1].forEach((s) => {
    ctx.save(); ctx.rotate(s * flop);
    const eg = ctx.createLinearGradient(0, -r, 0, r * 0.2);
    eg.addColorStop(0, ear.hi); eg.addColorStop(1, ear.lo);
    ctx.fillStyle = eg; ctx.strokeStyle = ear.line; ctx.lineWidth = Math.max(2, r * 0.05); ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s * r * 0.30, -r * 0.70);
    ctx.quadraticCurveTo(s * r * 0.32, -r * 0.98, s * r * 0.58, -r * 0.92);
    ctx.quadraticCurveTo(s * r * 0.98, -r * 0.82, s * r * 0.93, -r * 0.28);
    ctx.quadraticCurveTo(s * r * 0.88, r * 0.10, s * r * 0.56, r * 0.06);
    ctx.quadraticCurveTo(s * r * 0.43, r * 0.02, s * r * 0.44, -r * 0.24);
    ctx.quadraticCurveTo(s * r * 0.40, -r * 0.52, s * r * 0.30, -r * 0.70);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    /* inner-ear sheen near the top */
    ctx.fillStyle = 'rgba(255,226,190,0.4)';
    ctx.beginPath(); ctx.ellipse(s * r * 0.6, -r * 0.5, r * 0.13, r * 0.26, s * -0.3, 0, 7); ctx.fill();
    ctx.restore();
  });
  U.plush(ctx, r, col);
  /* white lower muzzle */
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
  ctx.fillStyle = '#FFF8EC';
  ctx.beginPath(); ctx.ellipse(0, r * 0.42, r * 0.5, r * 0.42, 0, 0, 7); ctx.fill();
  ctx.restore();
  U.blush(ctx, r, { y: 0.34, spread: 0.62, w: 0.18, h: 0.12, alpha: 0.55 });
  U.eyes(ctx, r, { dx, dy, mood, seed, now, eyeY: -0.1, size: 0.18, spacing: 0.36 });
  /* dark rounded nose */
  ctx.fillStyle = C.pupil; ctx.beginPath(); ctx.ellipse(0, r * 0.18, r * 0.13, r * 0.1, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-r * 0.04, r * 0.14, r * 0.045, r * 0.03, -0.4, 0, 7); ctx.fill();
  /* tiny smile under the nose to anchor the tongue */
  ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(1.4, r * 0.042); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.28); ctx.lineTo(0, r * 0.32);
  ctx.moveTo(-r * 0.1, r * 0.31); ctx.quadraticCurveTo(0, r * 0.38, r * 0.1, r * 0.31);
  ctx.stroke();
  /* plump little rounded tongue */
  ctx.fillStyle = '#FF9DBE'; ctx.strokeStyle = '#EC7AA0'; ctx.lineWidth = Math.max(1.2, r * 0.028); ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.08, r * 0.34);
  ctx.quadraticCurveTo(-r * 0.11, r * 0.47, 0, r * 0.47);
  ctx.quadraticCurveTo(r * 0.11, r * 0.47, r * 0.08, r * 0.34);
  ctx.quadraticCurveTo(0, r * 0.38, -r * 0.08, r * 0.34);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(214,86,122,0.55)'; ctx.lineWidth = Math.max(1, r * 0.022);
  ctx.beginPath(); ctx.moveTo(0, r * 0.39); ctx.lineTo(0, r * 0.45); ctx.stroke();
  U.sparkle(ctx, r * 0.5, -r * 0.74, r * 0.1, '#FFF3C4');
  ctx.restore();
};
