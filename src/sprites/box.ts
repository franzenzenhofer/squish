/* ============================================================================
   sprites/box.ts — marshmallow. A puffy vanilla pillow with a dusting of
   strawberry sprinkles and a sleepy, content face.
   ============================================================================ */
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { SpriteFn } from '../lib/types';

export const box: SpriteFn = (ctx, o) => {
  const x = o.x;
  const y = o.y;
  const now = o.now;
  const seed = o.seed ?? 0;
  const cell = o.cell;
  let sx = o.sx ?? 1;
  let sy = o.sy ?? 1;
  const s = cell * 0.62;
  if (o.idle) {
    const br = U.breathe(now, seed, 0.02);
    sx *= br.sx;
    sy *= br.sy;
  }

  U.ground(ctx, x, y + s * 0.56, s * 0.62);
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);

  /* puffy body */
  const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
  g.addColorStop(0, C.boxHi);
  g.addColorStop(1, C.boxLo);
  ctx.fillStyle = g;
  ctx.strokeStyle = C.boxLn;
  ctx.lineWidth = Math.max(2, cell * 0.035);
  U.rrect(ctx, -s / 2, -s / 2, s, s, s * 0.36);
  ctx.fill();
  ctx.stroke();

  /* bottom core shadow */
  ctx.save();
  U.rrect(ctx, -s / 2, -s / 2, s, s, s * 0.36);
  ctx.clip();
  const cg = ctx.createLinearGradient(0, s * 0.05, 0, s * 0.5);
  cg.addColorStop(0, 'rgba(244,212,172,0)');
  cg.addColorStop(1, 'rgba(244,212,172,0.65)');
  ctx.fillStyle = cg;
  ctx.fillRect(-s, -s, 2 * s, 2 * s);
  ctx.restore();

  /* top shine */
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  U.rrect(ctx, -s * 0.3, -s * 0.34, s * 0.6, s * 0.14, s * 0.07);
  ctx.fill();

  /* sleepy face that peeks awake now and then */
  const r = s * 0.72;
  const em = U.beat(now, seed, 6400, 1050) ? 'happy' : 'sleepy';
  U.blush(ctx, r, { y: 0.32 });
  U.eyes(ctx, r, { mood: em, seed, now });
  U.mouth(ctx, r, { mood: em === 'happy' ? 'cat' : 'smile', y: 0.36 });

  ctx.restore();
};
