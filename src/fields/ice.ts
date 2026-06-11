/* fields/ice — thin ice: a frosty rounded tile with a snowflake and a few
   frost specks. Shatters into shards when left. */
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { FieldFn } from '../lib/types';

export const ice: FieldFn = (ctx, o) => {
  const px = o.px, py = o.py, cell = o.cell;
  const ig = ctx.createLinearGradient(px, py - cell * 0.4, px, py + cell * 0.4);
  ig.addColorStop(0, C.iceHi); ig.addColorStop(1, C.ice);
  ctx.fillStyle = ig; ctx.strokeStyle = C.iceLn; ctx.lineWidth = 1.5;
  U.rrect(ctx, px - cell * 0.42, py - cell * 0.42, cell * 0.84, cell * 0.84, cell * 0.22); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(px - cell * 0.14, py - cell * 0.22, cell * 0.12, cell * 0.05, -0.5, 0, 7); ctx.fill();
  ctx.fillStyle = C.frost;
  const specks: ReadonlyArray<readonly [number, number, number]> =
    [[0.16, 0.12, 0.03], [-0.16, 0.18, 0.024], [0.2, -0.16, 0.02]];
  specks.forEach((f) => {
    ctx.beginPath(); ctx.arc(px + cell * f[0], py + cell * f[1], cell * f[2], 0, 7); ctx.fill();
  });
  ctx.strokeStyle = C.frost; ctx.lineWidth = Math.max(1, cell * 0.018); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3;
    ctx.beginPath();
    ctx.moveTo(px - Math.cos(a) * cell * 0.09, py - Math.sin(a) * cell * 0.09);
    ctx.lineTo(px + Math.cos(a) * cell * 0.09, py + Math.sin(a) * cell * 0.09);
    ctx.stroke();
  }
};
