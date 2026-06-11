/* fields/shards.ts — shattered ice: a soft pile of rounded ice pebbles that
   acts as a wall (no sharp edges, stays cute). */
import { C } from '../lib/palette';
import type { FieldFn } from '../lib/types';

export const shards: FieldFn = (ctx, o) => {
  const px = o.px, py = o.py, cell = o.cell;
  ctx.fillStyle = C.shard; ctx.strokeStyle = C.shardLn; ctx.lineWidth = 1.8;
  const pebbles: ReadonlyArray<readonly [number, number, number]> =
    [[-0.18, 0.12, 0.2], [0.16, 0.05, 0.17], [-0.02, 0.2, 0.14], [0.05, -0.15, 0.13]];
  pebbles.forEach((b) => {
    ctx.beginPath(); ctx.arc(px + cell * b[0], py + cell * b[1], cell * b[2], 0, 7); ctx.fill(); ctx.stroke();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(px - cell * 0.18, py + cell * 0.06, cell * 0.06, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(px + cell * 0.12, py - cell * 0.0, cell * 0.045, 0, 7); ctx.fill();
};
