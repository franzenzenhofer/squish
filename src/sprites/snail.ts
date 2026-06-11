/* ============================================================================
   sprites/snail.ts — pistachio snail with a glossy honey-swirl shell, two
   wiggly antennae, and a tiny smiley face. Faces its travel direction.
   ============================================================================ */
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { SpriteFn } from '../lib/types';

export const snail: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now || 0, seed = o.seed ?? 0, cell = o.cell;
  let sx = o.sx ?? 1, sy = o.sy ?? 1;
  const dir = (o.dx ?? 0) < 0 ? -1 : 1, s = cell * 0.3;
  if (o.idle) { const br = U.breathe(now, seed, 0.02); sx *= br.sx; sy *= br.sy; }

  U.ground(ctx, x, y + s * 0.88, s * 1.15);
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot * dir);
  ctx.scale(sx * dir, sy);

  /* foot + head as one soft body */
  const bg = ctx.createLinearGradient(0, -s * 0.2, 0, s * 0.95);
  bg.addColorStop(0, C.snailHi); bg.addColorStop(0.5, C.snail); bg.addColorStop(1, C.snailLo);
  ctx.fillStyle = bg; ctx.strokeStyle = C.snailLn; ctx.lineWidth = Math.max(1.6, s * 0.12); ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 1.05, s * 0.9);
  ctx.quadraticCurveTo(-s * 1.22, s * 0.2, -s * 0.6, s * 0.08);
  ctx.lineTo(s * 0.5, s * 0.02);
  ctx.quadraticCurveTo(s * 1.4, -s * 0.06, s * 1.32, s * 0.52);
  ctx.quadraticCurveTo(s * 1.3, s * 0.92, s * 0.78, s * 0.9);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  /* antennae */
  const wig = Math.sin(now * 0.005 + seed) * s * 0.09;
  const ax = s * 0.72;
  ctx.strokeStyle = C.snailLn; ctx.lineWidth = Math.max(1.2, s * 0.09); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax - s * 0.12, -s * 0.02); ctx.lineTo(ax - s * 0.2, -s * 0.54 + wig); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax + s * 0.16, -s * 0.02); ctx.lineTo(ax + s * 0.3, -s * 0.46 - wig); ctx.stroke();
  ctx.fillStyle = C.snailLn;
  ctx.beginPath(); ctx.arc(ax - s * 0.2, -s * 0.54 + wig, s * 0.09, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(ax + s * 0.3, -s * 0.46 - wig, s * 0.09, 0, 7); ctx.fill();

  /* shell */
  const sg = ctx.createRadialGradient(-s * 0.5, -s * 0.36, s * 0.08, -s * 0.25, -s * 0.06, s * 0.92);
  sg.addColorStop(0, C.shellHi); sg.addColorStop(0.6, C.shell); sg.addColorStop(1, C.shellLo);
  ctx.fillStyle = sg; ctx.strokeStyle = C.shellLn; ctx.lineWidth = Math.max(1.6, s * 0.11);
  ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.08, s * 0.76, 0, 7); ctx.fill(); ctx.stroke();
  ctx.lineWidth = Math.max(1.3, s * 0.09); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.08, s * 0.44, Math.PI * 0.1, Math.PI * 1.75); ctx.stroke();
  ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.08, s * 0.18, Math.PI * 0.9, Math.PI * 2.6); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(-s * 0.52, -s * 0.36, s * 0.16, s * 0.1, -0.5, 0, 7); ctx.fill();

  /* face on the head */
  ctx.save(); ctx.translate(s * 0.78, s * 0.34);
  const fr = s * 0.72;
  const slook = o.idle ? Math.sin(now * 0.0012 + seed) * 0.7 : 0;
  U.blush(ctx, fr, { y: 0.42, spread: 0.5 });
  U.eyes(ctx, fr, { mood: 'look', dx: slook, seed: seed, now: now, spacing: 0.3, size: 0.16 });
  U.mouth(ctx, fr, { mood: 'smile', dx: slook, y: 0.46 });
  ctx.restore();

  ctx.restore();
};
