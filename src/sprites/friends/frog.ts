/* sprites/friends/frog.ts — a mint frog with eyes on top. (bonus friend) */
import { C } from '../../lib/palette';
import * as U from '../../lib/draw';
import type { SpriteFn } from '../../lib/types';

export const frog: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now ?? 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const r = o.r ?? cell * 0.3;
  const dx = o.dx ?? 0, dy = o.dy ?? 0;
  const mood = o.mood ?? 'happy';
  if (o.idle !== false) { const br = U.breathe(now, seed, 0.03); sx *= br.sx; sy *= br.sy; }
  const col = { hi: '#E2F7D6', base: '#BFE9A8', lo: '#97D079', line: '#79B85F', core: '#AEDF92' };
  const blink = U.blinkOn(seed, now);
  U.ground(ctx, x, y + r * 0.98, r * 0.92);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);
  U.plush(ctx, r, col);
  ctx.fillStyle = col.base; ctx.strokeStyle = col.line; ctx.lineWidth = Math.max(2, r * 0.07);
  [-0.4, 0.4].forEach((ex) => { ctx.beginPath(); ctx.arc(r * ex, -r * 0.74, r * 0.27, 0, 7); ctx.fill(); ctx.stroke(); });
  [-0.4, 0.4].forEach((ex) => {
    const cx = r * ex, cy = -r * 0.78;
    if (mood === 'dizzy') {
      ctx.strokeStyle = C.pupil; ctx.lineWidth = Math.max(2, r * 0.07); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.1, cy - r * 0.1); ctx.lineTo(cx + r * 0.1, cy + r * 0.1);
      ctx.moveTo(cx + r * 0.1, cy - r * 0.1); ctx.lineTo(cx - r * 0.1, cy + r * 0.1);
      ctx.stroke(); return;
    }
    if (mood === 'joy') {
      ctx.strokeStyle = C.pupil; ctx.lineWidth = Math.max(2, r * 0.07); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.08, r * 0.14, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      return;
    }
    if (blink) { ctx.strokeStyle = C.pupil; ctx.lineWidth = Math.max(2, r * 0.07); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - r * 0.12, cy); ctx.lineTo(cx + r * 0.12, cy); ctx.stroke(); return; }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.17, 0, 7); ctx.fill();
    ctx.fillStyle = C.pupil; ctx.beginPath(); ctx.arc(cx + dx * r * 0.06, cy + r * 0.02 + dy * r * 0.04, r * 0.08, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + dx * r * 0.06 - r * 0.03, cy + dy * r * 0.04 - r * 0.02, r * 0.03, 0, 7); ctx.fill();
  });
  ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(2, r * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(dx * r * 0.1, r * 0.0, r * 0.44, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
  U.blush(ctx, r, { y: 0.22, spread: 0.68 });
  ctx.restore();
};
