/* fields/oneway.ts - candy gate: a mint rounded tile with a double chevron in
   the only direction you may pass. o.dir is a dir name */
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { FieldFn, Dir4 } from '../lib/types';

export const oneway: FieldFn = (ctx, o) => {
  const px = o.px, py = o.py, cell = o.cell;
  const DIRS: Record<Dir4, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const dv: [number, number] = (o.dir != null ? DIRS[o.dir] : undefined) ?? [1, 0];
  const mg = ctx.createLinearGradient(px, py - cell * 0.32, px, py + cell * 0.32);
  mg.addColorStop(0, C.mintHi); mg.addColorStop(1, C.mint);
  ctx.fillStyle = mg; ctx.strokeStyle = C.mintLn; ctx.lineWidth = 2;
  U.rrect(ctx, px - cell * 0.32, py - cell * 0.32, cell * 0.64, cell * 0.64, cell * 0.24); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  U.rrect(ctx, px - cell * 0.2, py - cell * 0.24, cell * 0.3, cell * 0.1, cell * 0.05); ctx.fill();
  ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(dv[1], dv[0]));
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2.5, cell * 0.075); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-cell * 0.1, -cell * 0.13); ctx.lineTo(cell * 0.06, 0); ctx.lineTo(-cell * 0.1, cell * 0.13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cell * 0.04, -cell * 0.13); ctx.lineTo(cell * 0.2, 0); ctx.lineTo(cell * 0.04, cell * 0.13); ctx.stroke();
  ctx.restore();
};
