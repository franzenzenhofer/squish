/* fields/wall.ts — a plush tufted cushion. Clearly solid, still cuddly. */
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { FieldFn } from '../lib/types';

export const wall: FieldFn = (ctx, o) => {
  const px = o.px, py = o.py, cell = o.cell;
  const wg = ctx.createLinearGradient(px, py - cell * 0.42, px, py + cell * 0.42);
  wg.addColorStop(0, C.wallHi); wg.addColorStop(1, C.wall);
  ctx.fillStyle = wg; ctx.strokeStyle = C.wallLn; ctx.lineWidth = 2;
  U.rrect(ctx, px - cell * 0.42, py - cell * 0.42, cell * 0.84, cell * 0.84, cell * 0.26); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(174,148,227,0.5)'; ctx.lineWidth = Math.max(1, cell * 0.02); ctx.lineCap = 'round';
  const tufts: ReadonlyArray<readonly [number, number]> = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  tufts.forEach((d) => {
    ctx.beginPath();
    ctx.moveTo(px + d[0] * cell * 0.08, py + d[1] * cell * 0.08);
    ctx.lineTo(px + d[0] * cell * 0.26, py + d[1] * cell * 0.26);
    ctx.stroke();
  });
  ctx.fillStyle = C.wallBtn;
  ctx.beginPath(); ctx.arc(px, py, cell * 0.05, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  U.rrect(ctx, px - cell * 0.3, py - cell * 0.3, cell * 0.26, cell * 0.12, cell * 0.06); ctx.fill();
};
