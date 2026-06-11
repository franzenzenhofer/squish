/* ============================================================================
   sprites/balloon.ts — a happy candy balloon. Five pastel themes picked by
   seed, diagonal candy stripes, a bright gloss, knot + curly string that
   lags behind the sway, and the same warm kawaii face as the rest of the
   cast. Floats slowly and dreamily — never springs.
   ============================================================================ */
import { BAL_THEMES, type BalloonTheme } from '../lib/palette';
import * as U from '../lib/draw';
import type { SpriteFn } from '../lib/types';

export const balloon: SpriteFn = (ctx, o) => {
  const x = o.x;
  const y = o.y;
  const now = o.now;
  const seed = o.seed ?? 0;
  const cell = o.cell;
  const sx = o.sx ?? 1;
  const sy = o.sy ?? 1;
  const idle = o.idle;
  const theme = BAL_THEMES[Math.abs(seed) % BAL_THEMES.length] as BalloonTheme;
  /* slow dreamy float: gentle bob, soft sway, string lagging behind */
  const bob = idle ? Math.sin(now * 0.0021 + seed) * 3.6 : 0;
  const sway = idle ? Math.sin(now * 0.0017 + seed) * 0.09 : 0;
  const lag = Math.sin(now * 0.0017 + seed - 0.7) * 0.12;
  const r = cell * 0.3;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(sway + (o.rot ?? 0));
  ctx.scale(sx, sy);

  /* curly ribbon, phase-lagged so it trails the sway */
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = Math.max(1.4, cell * 0.022);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 1.04);
  ctx.bezierCurveTo(
    r * (0.42 + lag), r * 1.36,
    -r * (0.3 - lag), r * 1.5,
    r * (0.12 + lag * 1.6), r * 1.82
  );
  ctx.stroke();

  /* round body */
  const g = ctx.createRadialGradient(-r * 0.32, -r * 0.4, r * 0.08, 0, r * 0.06, r * 1.22);
  g.addColorStop(0, theme.hi);
  g.addColorStop(0.55, theme.base);
  g.addColorStop(1, theme.lo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.93, r, 0, 0, 7);
  ctx.fill();

  /* candy stripes, clipped inside the body */
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.93, r, 0, 0, 7);
  ctx.clip();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = theme.hi;
  ctx.rotate(-0.5);
  for (let i = -2; i <= 2; i += 2) {
    ctx.fillRect(i * r * 0.42 - r * 0.13, -r * 1.6, r * 0.26, r * 3.2);
  }
  ctx.restore();

  /* outline over the stripes */
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.93, r, 0, 0, 7);
  ctx.stroke();

  /* knot */
  ctx.fillStyle = theme.lo;
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, r * 0.95);
  ctx.lineTo(r * 0.15, r * 0.95);
  ctx.quadraticCurveTo(r * 0.05, r * 1.22, 0, r * 1.2);
  ctx.quadraticCurveTo(-r * 0.05, r * 1.22, -r * 0.15, r * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  /* gloss */
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.36, -r * 0.4, r * 0.2, r * 0.3, -0.5, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(r * 0.26, r * 0.34, r * 0.08, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 1;

  /* warm kawaii face — eyes wander around curiously */
  const look = o.idle ? Math.sin(now * 0.0009 + seed) * 0.85 : 0;
  U.blush(ctx, r, { y: 0.3, spread: 0.5 });
  U.eyes(ctx, r, { mood: 'look', dx: look, seed, now, spacing: 0.34, size: 0.17 });
  U.mouth(ctx, r, { mood: 'smile', dx: look, y: 0.31 });

  ctx.restore();
};
