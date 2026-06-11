/* ============================================================================
   sprites/balloon.ts — a friendly round helium balloon. Soft round body, a
   bright gloss, a knot + short curly string, and the same warm kawaii face as
   the rest of the cast (so it never looks uncanny). Bobs gently when idle.
   ============================================================================ */
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { SpriteFn } from '../lib/types';

export const balloon: SpriteFn = (ctx, o) => {
  const x = o.x;
  const y = o.y;
  const now = o.now;
  const seed = o.seed ?? 0;
  const cell = o.cell;
  const sx = o.sx ?? 1;
  const sy = o.sy ?? 1;
  const idle = o.idle;
  const bob = idle ? U.bob(now, seed, 2.6) : 0;
  const sway = idle ? Math.sin(now * 0.0024 + seed) * 0.05 : 0;
  const r = cell * 0.3;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(sway + (o.rot ?? 0));
  ctx.scale(sx, sy);

  /* short curly ribbon */
  ctx.strokeStyle = C.balLn;
  ctx.lineWidth = Math.max(1.4, cell * 0.022);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 1.04);
  ctx.bezierCurveTo(r * 0.42, r * 1.36, -r * 0.3, r * 1.5, r * 0.12, r * 1.82);
  ctx.stroke();

  /* round body */
  const g = ctx.createRadialGradient(-r * 0.32, -r * 0.4, r * 0.08, 0, r * 0.06, r * 1.22);
  g.addColorStop(0, C.balHi);
  g.addColorStop(0.55, C.bal);
  g.addColorStop(1, C.balLo);
  ctx.fillStyle = g;
  ctx.strokeStyle = C.balLn;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.93, r, 0, 0, 7);
  ctx.fill();
  ctx.stroke();

  /* knot */
  ctx.fillStyle = C.balLo;
  ctx.strokeStyle = C.balLn;
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, r * 0.95);
  ctx.lineTo(r * 0.15, r * 0.95);
  ctx.quadraticCurveTo(r * 0.05, r * 1.22, 0, r * 1.2);
  ctx.quadraticCurveTo(-r * 0.05, r * 1.22, -r * 0.15, r * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  /* gloss */
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.36, -r * 0.4, r * 0.2, r * 0.3, -0.5, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(r * 0.26, r * 0.34, r * 0.08, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 1;

  /* warm kawaii face — eyes wander around curiously */
  const look = o.idle ? Math.sin(now * 0.0009 + seed) * 0.85 : 0;
  U.blush(ctx, r, { y: 0.3, spread: 0.5 });
  U.eyes(ctx, r, { mood: 'look', dx: look, seed, now, spacing: 0.34, size: 0.17 });
  U.mouth(ctx, r, { mood: 'smile', dx: look, y: 0.31 });

  ctx.restore();
};
