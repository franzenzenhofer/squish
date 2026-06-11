/* ============================================================================
   sprites/nomster.ts — a fluffy lilac friend who sits on the field and
   idle-chomps. Eyes up top, big soft mouth with rounded teeth + tongue.
   When fed it beams (joy eyes, closed happy mouth).
   o adds: { chomp (scale), mood: 'idle'|'feed' }
   ============================================================================ */
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { SpriteFn } from '../lib/types';

export const nomster: SpriteFn = (ctx, o) => {
  const x = o.x, y = o.y, now = o.now || 0, cell = o.cell;
  const hs = o.chomp ?? 1;
  const fed = o.mood === 'feed';
  const open = fed ? 0.08 : 0.4 + 0.45 * Math.max(0, Math.sin(now * 0.0026 + (x + y)));

  U.ground(ctx, x, y + cell * 0.36, cell * 0.44);
  ctx.save(); ctx.translate(x, y); ctx.scale(hs, hs);
  const r = cell * 0.34;

  /* rounded ears */
  ctx.fillStyle = C.nomLo; ctx.strokeStyle = C.nomLn; ctx.lineWidth = Math.max(2, r * 0.08);
  const ears: Array<[number, number, number]> = [[-0.6, -0.82, -0.35], [0.6, -0.82, 0.35]];
  for (const p of ears) {
    ctx.save(); ctx.translate(r * p[0], r * p[1]); ctx.rotate(p[2]);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.17, r * 0.27, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /* plush body */
  U.plush(ctx, r, { hi: C.nomHi, base: C.nom, lo: C.nomLo, line: C.nomLn, core: C.nomCore });

  /* eyes up high — happy squint now and then */
  const nem = fed ? 'joy' : (U.beat(now, x * 3 + y, 4400, 560) ? 'joy' : 'happy');
  U.eyes(ctx, r, { mood: nem, seed: (x * 3 + y), now: now, eyeY: -0.3, size: 0.15, spacing: 0.36 });

  /* mouth */
  if (fed) {
    U.mouth(ctx, r, { mood: 'joy', y: 0.34 });
  } else {
    const mh = r * (0.3 + 0.4 * open);
    ctx.fillStyle = C.nomMouth;
    ctx.beginPath(); ctx.ellipse(0, r * 0.32, r * 0.46, mh * 0.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = C.tongue;
    ctx.beginPath(); ctx.ellipse(0, r * 0.32 + mh * 0.16, r * 0.24, mh * 0.26, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    for (const t of [-1, 1]) { ctx.beginPath(); ctx.arc(t * r * 0.24, r * 0.32 - mh * 0.4, r * 0.08, 0, 7); ctx.fill(); }
  }

  /* cheeks */
  U.blush(ctx, r, { y: 0.02, spread: 0.62, w: 0.13, h: 0.1 });

  ctx.restore();
};
