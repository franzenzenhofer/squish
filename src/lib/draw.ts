/* Shared canvas primitives — the cuteness engine: plush body shader, glossy
   kawaii eyes, mouths, blush, ground shadows, hearts, stars, sparkles, and
   idle-motion helpers. Every sprite/field composes itself from these so the
   whole world matches. All draws assume the caller translated to the center. */
import { C } from './palette';

type Ctx = CanvasRenderingContext2D;

export interface PlushTint {
  hi: string;
  base: string;
  lo: string;
  line: string;
  core?: string;
}

export interface EyeOpts {
  dx?: number;
  dy?: number;
  mood?: string;
  seed?: number;
  now?: number;
  spacing?: number;
  eyeY?: number;
  size?: number;
}

export interface MouthOpts {
  mood?: string;
  y?: number;
  dx?: number;
}

export interface BlushOpts {
  y?: number;
  spread?: number;
  w?: number;
  h?: number;
  alpha?: number;
  color?: string;
}

export function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function heart(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.64);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.02, x - s * 0.62, y - s * 0.82, x, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.62, y - s * 0.82, x + s * 1.1, y - s * 0.02, x, y + s * 0.64);
  ctx.closePath();
}

export function star4(ctx: Ctx, x: number, y: number, R: number, r2: number): void {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a1 = (i * Math.PI) / 2;
    const a2 = a1 + Math.PI / 4;
    if (i === 0) ctx.moveTo(x + Math.cos(a1) * R, y + Math.sin(a1) * R);
    else ctx.lineTo(x + Math.cos(a1) * R, y + Math.sin(a1) * R);
    ctx.lineTo(x + Math.cos(a2) * r2, y + Math.sin(a2) * r2);
  }
  ctx.closePath();
}

export function star5(ctx: Ctx, x: number, y: number, R: number, r2: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? R : r2;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/* soft ground shadow — call in world coords, before translate */
export function ground(ctx: Ctx, x: number, y: number, w: number, alpha?: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, w);
  g.addColorStop(0, 'rgba(120,70,95,' + (alpha == null ? 0.16 : alpha) + ')');
  g.addColorStop(1, 'rgba(120,70,95,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, w, w * 0.42, 0, 0, 7);
  ctx.fill();
}

/* plush body shader: gradient + core shadow + rim + shine, at origin */
export function plush(ctx: Ctx, r: number, c: PlushTint): void {
  const g = ctx.createRadialGradient(-r * 0.34, -r * 0.44, r * 0.06, 0, 0, r * 1.18);
  g.addColorStop(0, c.hi);
  g.addColorStop(0.5, c.base);
  g.addColorStop(1, c.lo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 7);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 7);
  ctx.clip();
  const cg = ctx.createRadialGradient(0, r * 0.6, r * 0.08, 0, r * 0.6, r * 1.15);
  cg.addColorStop(0, c.core || c.lo);
  cg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = cg;
  ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.restore();
  ctx.strokeStyle = c.line;
  ctx.lineWidth = Math.max(2, r * 0.085);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 7);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, Math.PI * 1.05, Math.PI * 1.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.48, r * 0.26, r * 0.13, -0.5, 0, 7);
  ctx.fill();
}

export function blush(ctx: Ctx, r: number, o?: BlushOpts): void {
  o = o || {};
  const y = (o.y != null ? o.y : 0.27) * r;
  const sp = (o.spread != null ? o.spread : 0.54) * r;
  const w = (o.w != null ? o.w : 0.17) * r;
  const h = (o.h != null ? o.h : 0.11) * r;
  ctx.save();
  ctx.globalAlpha = o.alpha != null ? o.alpha : 0.5;
  ctx.fillStyle = o.color || C.blush;
  ctx.beginPath();
  ctx.ellipse(-sp, y, w, h, 0, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(sp, y, w, h, 0, 0, 7);
  ctx.fill();
  ctx.restore();
}

/* glossy kawaii eyes — moods: happy, joy, sleepy, dizzy, wink, look.
   Auto-blinks on happy/look. */
export function eyes(ctx: Ctx, r: number, o?: EyeOpts): void {
  o = o || {};
  const dx = o.dx || 0;
  const dy = o.dy || 0;
  const mood = o.mood || 'happy';
  const seed = o.seed || 0;
  const now = o.now || 0;
  const sp = (o.spacing != null ? o.spacing : 0.36) * r;
  const ey = (o.eyeY != null ? o.eyeY : 0.0) * r + dy * r * 0.1;
  const fx = dx * r * 0.13;
  const ew = (o.size != null ? o.size : 0.17) * r;
  const eh = ew * 1.34;
  const lw = Math.max(2, r * 0.1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const LR = (fn: (x: number) => void): void => {
    fn(-sp);
    fn(sp);
  };
  const openEye = (x: number): void => {
    const eg = ctx.createLinearGradient(0, ey - eh, 0, ey + eh);
    eg.addColorStop(0, C.pupil);
    eg.addColorStop(1, C.pupilLo);
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(x + fx, ey, ew, eh, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + fx - ew * 0.34, ey - eh * 0.36, ew * 0.44, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + fx + ew * 0.32, ey + eh * 0.3, ew * 0.22, 0, 7);
    ctx.fill();
  };
  const arcEye = (x: number): void => {
    ctx.strokeStyle = C.pupil;
    ctx.lineWidth = lw * 1.05;
    ctx.beginPath();
    ctx.arc(x + fx, ey + ew * 0.5, ew * 0.95, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  };
  const lineEye = (x: number): void => {
    ctx.strokeStyle = C.pupil;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x + fx - ew * 0.72, ey);
    ctx.lineTo(x + fx + ew * 0.72, ey);
    ctx.stroke();
  };
  if (mood === 'dizzy') {
    ctx.strokeStyle = C.pupil;
    ctx.lineWidth = lw;
    LR((x) => {
      ctx.beginPath();
      ctx.moveTo(x + fx - ew * 0.7, ey - ew * 0.7);
      ctx.lineTo(x + fx + ew * 0.7, ey + ew * 0.7);
      ctx.moveTo(x + fx + ew * 0.7, ey - ew * 0.7);
      ctx.lineTo(x + fx - ew * 0.7, ey + ew * 0.7);
      ctx.stroke();
    });
    return;
  }
  if (mood === 'joy') {
    LR(arcEye);
    return;
  }
  if (mood === 'sleepy') {
    ctx.strokeStyle = C.pupil;
    ctx.lineWidth = lw;
    LR((x) => {
      ctx.beginPath();
      ctx.arc(x + fx, ey - ew * 0.25, ew * 0.8, Math.PI * 0.12, Math.PI * 0.88);
      ctx.stroke();
    });
    return;
  }
  if (mood === 'wink') {
    openEye(-sp);
    arcEye(sp);
    return;
  }
  if ((mood === 'happy' || mood === 'look') && blinkOn(seed, now)) {
    LR(lineEye);
    return;
  }
  LR(openEye);
}

export function mouth(ctx: Ctx, r: number, o?: MouthOpts): void {
  o = o || {};
  const mood = o.mood || 'smile';
  const y = (o.y != null ? o.y : 0.27) * r;
  const x = (o.dx || 0) * r * 0.1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (mood === 'joy' || mood === 'open') {
    ctx.fillStyle = C.line;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.02, r * 0.16, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.tongue;
    ctx.beginPath();
    ctx.arc(x, y + r * 0.07, r * 0.075, 0, Math.PI);
    ctx.fill();
  } else if (mood === 'cat') {
    ctx.strokeStyle = C.line;
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath();
    ctx.arc(x - r * 0.07, y, r * 0.075, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.moveTo(x + r * 0.005, y);
    ctx.arc(x + r * 0.07, y, r * 0.075, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
  } else if (mood === 'o') {
    ctx.fillStyle = C.line;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.08, r * 0.1, 0, 0, 7);
    ctx.fill();
  } else {
    ctx.strokeStyle = C.line;
    ctx.lineWidth = Math.max(1.6, r * 0.075);
    ctx.beginPath();
    ctx.arc(x, y - r * 0.03, r * 0.12, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
}

/* twinkle sparkle */
export function sparkle(ctx: Ctx, x: number, y: number, s: number, col: string, glow?: string): void {
  if (glow) {
    const g = ctx.createRadialGradient(x, y, s * 0.1, x, y, s * 1.1);
    g.addColorStop(0, glow);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, s * 1.1, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = col;
  star4(ctx, x, y, s, s * 0.28);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x - s * 0.15, y - s * 0.15, s * 0.2, 0, 7);
  ctx.fill();
}

/* two little rounded feet at the base of a body */
export function feet(ctx: Ctx, r: number, color: string, line: string, wig?: number): void {
  wig = wig || 0;
  ctx.fillStyle = color;
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  const pads: Array<[number, number]> = [[-r * 0.42, 1], [r * 0.42, -1]];
  for (const f of pads) {
    ctx.beginPath();
    ctx.ellipse(f[0] + f[1] * wig, r * 0.92, r * 0.24, r * 0.16, 0, 0, 7);
    ctx.fill();
    ctx.stroke();
  }
}

/* idle motion helpers */
export function breathe(now: number, seed: number, amt?: number): { sx: number; sy: number } {
  const b = 1 + (amt || 0.03) * Math.sin(now * 0.0028 + seed);
  return { sx: b, sy: 1 / b };
}

export function bob(now: number, seed?: number, px?: number): number {
  return Math.sin(now * 0.0035 + (seed || 0)) * (px || 2);
}

export function blinkOn(seed: number, now: number): boolean {
  return ((now * 0.001 + seed * 0.61) % 3.7) < 0.12;
}

/* true during a short recurring window — drives each character's "mimik" */
export function beat(now: number, seed: number, period: number, win: number): boolean {
  return ((now + (seed || 0) * 811) % period) < win;
}
