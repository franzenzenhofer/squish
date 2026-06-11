/* ============================================================================
   sprites/squishy.ts — the hero. A strawberry-cream plush bean with a little
   heart sprout on top, tiny feet, and big glossy eyes that look where it's
   going.
   o = { x, y, r, cell, now, sx, sy, dx, dy, mood, seed, idle }
   ============================================================================ */
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { SpriteFn } from '../lib/types';

export const squishy: SpriteFn = (ctx, o) => {
  const x = o.x;
  const y = o.y;
  const r = o.r ?? o.cell * 0.3;
  const now = o.now;
  const seed = o.seed ?? 0;
  let sx = o.sx ?? 1;
  let sy = o.sy ?? 1;
  const dx = o.dx ?? 0;
  const dy = o.dy ?? 0;
  const mood = o.mood || 'happy';
  if (o.idle) {
    const br = U.breathe(now, seed, 0.035);
    sx *= br.sx;
    sy *= br.sy;
  }

  U.ground(ctx, x, y + r * 0.98, r * 0.95);
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(sx, sy);

  /* feet peeking out under the body */
  U.feet(ctx, r, C.bibiLo, C.bibiLn, Math.sin(now * 0.004 + seed) * r * 0.02);

  /* plush body */
  U.plush(ctx, r, { hi: C.bibiHi, base: C.bibi, lo: C.bibiLo, line: C.bibiLn, core: C.bibiCore });

  /* face */
  let fm: string = mood;
  if (fm === 'happy' && o.idle && !dx && !dy) {
    if (U.beat(now, seed, 5200, 460)) fm = 'wink';
    else if (U.beat(now, seed + 2.3, 8200, 600)) fm = 'joy';
  }
  U.blush(ctx, r);
  U.eyes(ctx, r, { dx, dy, mood: fm, seed, now });
  U.mouth(ctx, r, {
    mood: fm === 'joy' ? 'joy' : fm === 'dizzy' || fm === 'worried' ? 'o' : 'smile',
    dx, y: 0.28
  });

  ctx.restore();
};
