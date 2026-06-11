/* sprites/friends/panda.ts — a little panda. (bonus friend) */
import { C } from '../../lib/palette';
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const panda: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  const blk = '#5A5060';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.03); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#FFFFFF', base: '#FBFAFE', lo: '#ECEAF2', line: '#CFC9DA', core: '#F4F2F8' };
  U.ground(ctx, x, y + r * 0.98, r * 0.9);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  ctx.fillStyle = blk;
  ([[-0.6, -0.64], [0.6, -0.64]] as const).forEach(([px, py]) => { ctx.beginPath(); ctx.arc(r * px, r * py, r * 0.24, 0, 7); ctx.fill(); });
  U.plush(ctx, r, col);
  ctx.fillStyle = blk;
  ([[-0.34, -0.02, 0.42], [0.34, -0.02, -0.42]] as const).forEach(([px, py, rot]) => { ctx.save(); ctx.translate(r * px, r * py); ctx.rotate(rot); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.17, r * 0.23, 0, 0, 7); ctx.fill(); ctx.restore(); });
  /* eyes on the patches — pupils track dx/dy, with dizzy/joy variants */
  const ew = r * 0.085;
  const fx = dx * r * 0.03, fy = dy * r * 0.025;
  ([[-0.34, -0.02], [0.34, -0.02]] as const).forEach(([px, py]) => {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * px, r * py, ew, 0, 7); ctx.fill();
    if (mood === 'dizzy') {
      ctx.strokeStyle = C.pupil; ctx.lineWidth = Math.max(1.5, r * 0.045); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(r * px - ew * 0.7, r * py - ew * 0.7); ctx.lineTo(r * px + ew * 0.7, r * py + ew * 0.7);
      ctx.moveTo(r * px + ew * 0.7, r * py - ew * 0.7); ctx.lineTo(r * px - ew * 0.7, r * py + ew * 0.7);
      ctx.stroke();
    } else if (mood === 'joy') {
      ctx.strokeStyle = C.pupil; ctx.lineWidth = Math.max(1.5, r * 0.045); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(r * px, r * py + ew * 0.5, ew * 0.95, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else {
      ctx.fillStyle = C.pupil; ctx.beginPath(); ctx.arc(r * px + fx, r * py + r * 0.01 + fy, r * 0.05, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * px + fx - r * 0.02, r * py + fy - r * 0.02, r * 0.02, 0, 7); ctx.fill();
    }
  });
  ctx.fillStyle = blk; ctx.beginPath(); ctx.ellipse(0, r * 0.22, r * 0.06, r * 0.045, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = blk; ctx.lineWidth = Math.max(1.4, r * 0.045); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.26); ctx.quadraticCurveTo(-r * 0.07, r * 0.33, -r * 0.12, r * 0.28);
  ctx.moveTo(0, r * 0.26); ctx.quadraticCurveTo(r * 0.07, r * 0.33, r * 0.12, r * 0.28);
  ctx.stroke();
  U.blush(ctx, r, { y: 0.3, spread: 0.66 });
  ctx.restore();
};
