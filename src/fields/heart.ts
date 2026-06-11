/* fields/heart — the goal. Open: a glossy pink heart with glow, beat and
   orbiting sparkles. Locked (stars remain): a sleepy steel heart wearing a
   riveted band and a tiny padlock. Unlocking: the band drops away and the
   pink heart blooms through (o.unlockP 0..1). */
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { FieldFn, FieldOpts } from '../lib/types';

type Ctx = CanvasRenderingContext2D;

function pinkHeart(ctx: Ctx, o: FieldOpts, alpha: number): void {
  const { px, py, cell, now, won } = o;
  const hp = 1 + 0.06 * Math.sin(now * 0.004);
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(px, py, cell * 0.1, px, py, cell * 0.46);
  g.addColorStop(0, 'rgba(255,107,157,0.2)');
  g.addColorStop(1, 'rgba(255,107,157,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, cell * 0.46, 0, 7);
  ctx.fill();
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(hp, hp);
  if (won) {
    const fg = ctx.createRadialGradient(-cell * 0.1, -cell * 0.14, cell * 0.04, 0, 0, cell * 0.42);
    fg.addColorStop(0, C.heartHi);
    fg.addColorStop(1, C.heart);
    ctx.fillStyle = fg;
    U.heart(ctx, 0, 0, cell * 0.32);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,107,157,0.14)';
    U.heart(ctx, 0, 0, cell * 0.32);
    ctx.fill();
  }
  ctx.strokeStyle = C.heart;
  ctx.lineWidth = Math.max(3, cell * 0.075);
  ctx.lineJoin = 'round';
  U.heart(ctx, 0, 0, cell * 0.32);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(-cell * 0.1, -cell * 0.06, cell * 0.06, cell * 0.04, -0.6, 0, 7);
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < 2; i++) {
    const a = now * 0.0014 + i * Math.PI + (px + py);
    U.sparkle(ctx, px + Math.cos(a) * cell * 0.42, py + Math.sin(a) * cell * 0.42,
      cell * 0.05, C.heartHi);
  }
  ctx.restore();
}

/** Steel shell: heart body in steel + riveted band + padlock. `drop` 0..1
    slides the lock hardware down and fades it out (the unlock). */
function steelHeart(ctx: Ctx, o: FieldOpts, drop: number): void {
  const { px, py, cell, now } = o;
  const hp = 1 + 0.025 * Math.sin(now * 0.0024); /* slow sleepy beat */
  ctx.save();
  ctx.globalAlpha = 1 - drop;
  const g = ctx.createRadialGradient(px, py, cell * 0.1, px, py, cell * 0.44);
  g.addColorStop(0, 'rgba(159,170,198,0.16)');
  g.addColorStop(1, 'rgba(159,170,198,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, cell * 0.44, 0, 7);
  ctx.fill();
  ctx.save();
  ctx.translate(px, py + drop * drop * cell * 0.9);
  ctx.rotate(drop * 0.5);
  ctx.scale(hp, hp);
  const r = cell * 0.32;
  const bg = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.06, 0, 0, r * 1.3);
  bg.addColorStop(0, C.steelHi);
  bg.addColorStop(0.55, C.steel);
  bg.addColorStop(1, C.steelLo);
  ctx.fillStyle = bg;
  ctx.strokeStyle = C.steelLn;
  ctx.lineWidth = Math.max(3, cell * 0.075);
  ctx.lineJoin = 'round';
  U.heart(ctx, 0, 0, r);
  ctx.fill();
  ctx.stroke();
  /* riveted band across the middle */
  ctx.save();
  U.heart(ctx, 0, 0, r);
  ctx.clip();
  ctx.fillStyle = C.steelLo;
  ctx.strokeStyle = C.steelLn;
  ctx.lineWidth = Math.max(1.5, cell * 0.03);
  U.rrect(ctx, -r * 1.1, -r * 0.18, r * 2.2, r * 0.34, r * 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.steelHi;
  for (const rx of [-r * 0.55, 0, r * 0.55]) {
    ctx.beginPath();
    ctx.arc(rx, -r * 0.01, r * 0.055, 0, 7);
    ctx.fill();
  }
  ctx.restore();
  /* tiny padlock hanging at the notch */
  const ly = r * 0.62;
  ctx.strokeStyle = C.steelLn;
  ctx.lineWidth = Math.max(2, cell * 0.04);
  ctx.beginPath();
  ctx.arc(0, ly, r * 0.16, Math.PI, 0, false); /* shackle */
  ctx.stroke();
  ctx.fillStyle = C.steel;
  U.rrect(ctx, -r * 0.22, ly, r * 0.44, r * 0.38, r * 0.09);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.steelLn;
  ctx.beginPath();
  ctx.arc(0, ly + r * 0.17, r * 0.05, 0, 7);
  ctx.fill();
  /* soft shine so it still feels plush */
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.2, r * 0.16, r * 0.1, -0.6, 0, 7);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

export const heart: FieldFn = (ctx, o) => {
  const p = o.unlockP;
  if (o.locked) {
    steelHeart(ctx, o, 0);
    return;
  }
  if (p !== undefined && p < 1) {
    /* unlocking: pink blooms beneath while the steel shell drops away */
    pinkHeart(ctx, o, p);
    steelHeart(ctx, o, p);
    return;
  }
  pinkHeart(ctx, o, 1);
};
