/* fields/spring.ts - BOUNCE. An ultra-cute plush spring-buddy: a kawaii plush
   head (same plush/eyes/blush language as the friends + squishy) bobbing on a
   springy coil, squashing on the way down and opening a little "boing!" mouth on
   the way up, with a wobbly antenna bobble on top. */
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { FieldFn } from '../lib/types';

export const spring: FieldFn = (ctx, o) => {
  const px = o.px, py = o.py, cell = o.cell, now = o.now;
  const gx = o.gx ?? 0, gy = o.gy ?? 0;
  ctx.save(); ctx.translate(px, py);

  const comp = 0.5 + 0.5 * Math.sin(now * 0.005 + gx * 1.3 + gy); // 0 squashed .. 1 stretched up
  const r = cell * 0.21;                          // plush head radius (a touch smaller)
  const baseY = cell * 0.34;
  const headY = -cell * 0.02 - comp * cell * 0.12; // bobs up with the bounce

  U.ground(ctx, 0, baseY + cell * 0.02, cell * 0.4);

  /* springy coil from the ground up to just under the head */
  const rings = 4;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2.5, cell * 0.07);
  for (let i = 0; i < rings; i++) {
    const f = i / (rings - 1);
    const yy = baseY + (headY + r * 0.75 - baseY) * f;
    const rw = cell * (0.2 - f * 0.045);
    ctx.strokeStyle = i % 2 ? C.springStem : C.springLn;
    ctx.beginPath(); ctx.ellipse(0, yy, rw, cell * 0.05, 0, 0, 7); ctx.stroke();
  }

  /* the plush head, squashing/stretching with the bounce */
  ctx.save();
  ctx.translate(0, headY);
  const sx = 1 + (1 - comp) * 0.13, sy = 1 - (1 - comp) * 0.13;
  ctx.scale(sx, sy);

  /* a springy antenna with a bobble on top */
  ctx.strokeStyle = C.springLn; ctx.lineWidth = Math.max(1.8, r * 0.12); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.92);
  ctx.quadraticCurveTo(r * 0.18, -r * 1.2, r * 0.04, -r * 1.42);
  ctx.stroke();
  ctx.fillStyle = C.springHi; ctx.strokeStyle = C.springLn; ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.beginPath(); ctx.arc(r * 0.04, -r * 1.52, r * 0.17, 0, 7); ctx.fill(); ctx.stroke();

  U.plush(ctx, r, { hi: C.springHi, base: C.spring, lo: C.springLo, line: C.springLn, core: C.springLo });

  /* kawaii face — joy squint at the top of the bounce */
  const nem = comp > 0.72 ? 'joy' : 'happy';
  U.eyes(ctx, r, { mood: nem, seed: gx * 3 + gy, now, eyeY: -0.14, size: 0.17, spacing: 0.34 });
  U.blush(ctx, r, { y: 0.22, spread: 0.62, w: 0.16, h: 0.11 });

  /* a happy little smile (widens a touch at the top of the bounce) */
  ctx.strokeStyle = C.springLn; ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, r * 0.1);
  const mw = r * (0.16 + 0.06 * comp);
  ctx.beginPath();
  ctx.moveTo(-mw, r * 0.3);
  ctx.quadraticCurveTo(0, r * 0.46, mw, r * 0.3);
  ctx.stroke();

  ctx.restore();
  ctx.restore();
};
