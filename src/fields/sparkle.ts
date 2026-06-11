/* fields/sparkle.ts — splitter: a glowing twinkle with little orbiting
   sparkles. */
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { FieldFn } from '../lib/types';

export const sparkle: FieldFn = (ctx, o) => {
  const px = o.px, py = o.py, cell = o.cell, now = o.now;
  const gx = o.gx ?? 0, gy = o.gy ?? 0;
  const tw = 0.9 + 0.12 * Math.sin(now * 0.004 + gx + gy);
  ctx.save(); ctx.translate(px, py); ctx.rotate(now * 0.0009); ctx.scale(tw, tw);
  U.sparkle(ctx, 0, 0, cell * 0.3, C.star, 'rgba(255,143,194,0.42)');
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const a = now * 0.0016 + i * 2.1 + gx;
    const tx = px + Math.cos(a) * cell * 0.34, ty = py + Math.sin(a) * cell * 0.34;
    ctx.fillStyle = C.starHi;
    U.star4(ctx, tx, ty, cell * 0.05, cell * 0.018); ctx.fill();
  }
};
