/* Rendering — board, fields, actors, particles and the hint arrow.
   All drawing is delegated to the per-graphic modules (SPR / FLD). */
import { DIRS, key } from '../engine/core';
import type { Dir } from '../engine/types';
import { FLD } from '../fields';
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { Dir4, Mood, SpriteOpts } from '../lib/types';
import { SPR } from '../sprites';
import { cx, cy, dotR, easeOC } from './fx';
import type { AnimSprite, Session } from './session';

const KIND_SPRITE: Record<string, string> = {
  dot: 'squishy', box: 'box', balloon: 'balloon', snail: 'snail',
  penguin: 'penguin', bear: 'bear', ghost: 'ghost', bunny: 'bunny',
  frog: 'frog', panda: 'panda', cat: 'cat', chick: 'chick', pig: 'pig'
};

export function mods(
  s: Session, cellKey: string, now: number
): { sx: number; sy: number; rot: number } {
  let sx = 1;
  let sy = 1;
  let rot = 0;
  for (const p of s.pulses) {
    if (p.key !== cellKey) continue;
    const t = (now - p.t0) / p.dur;
    if (t < 0 || t > 1) continue;
    const w = Math.sin(t * Math.PI);
    if (p.type === 'pop') {
      sx += (p.amp ?? 0.3) * w;
      sy += (p.amp ?? 0.3) * w;
    } else if (p.type === 'squash') {
      const a = p.amp ?? 0.26;
      if (p.axis === 'x') {
        sx += a * w;
        sy -= a * 0.72 * w;
      } else {
        sy += a * w;
        sx -= a * 0.72 * w;
      }
    } else if (p.type === 'shake') {
      /* decaying head wobble — four no-no shakes */
      rot += (p.amp ?? 0.16) * Math.sin(t * Math.PI * 4) * (1 - t);
    }
  }
  return { sx, sy, rot };
}

function chompScale(s: Session, k: string, now: number): number {
  let v = 1;
  for (const p of s.pulses) {
    if (p.type === 'chomp' && p.key === k) {
      const t = (now - p.t0) / p.dur;
      if (t >= 0 && t <= 1) v += 0.4 * Math.sin(t * Math.PI);
    }
  }
  return v;
}

export function drawMover(
  ctx: CanvasRenderingContext2D, s: Session, kind: string, x: number, y: number,
  r: number, sx: number, sy: number, dx: number, dy: number,
  mood: Mood, seed: number, now: number, idle: boolean, rot = 0
): void {
  const fn = SPR[KIND_SPRITE[kind] ?? 'squishy'];
  if (!fn) return;
  const o: SpriteOpts = { x, y, cell: s.cell, now, sx, sy, dx, dy, mood, seed, idle, rot };
  if (r > 0) o.r = r; // r=0 means "use the sprite's natural size"
  fn(ctx, o);
}

function drawAmbients(ctx: CanvasRenderingContext2D, s: Session, now: number): void {
  for (const am of s.ambients) {
    let ay = am.y - ((now * 0.001 * am.v) % (s.cell * s.level.h + 50));
    if (ay < s.oy - 24) ay += s.cell * s.level.h + 50;
    const ax = am.x + Math.sin(now * 0.001 + am.ph) * 6;
    ctx.save();
    ctx.globalAlpha = 0.1 + 0.05 * Math.sin(now * 0.002 + am.ph);
    if (am.star) {
      ctx.fillStyle = C.yel;
      U.star5(ctx, ax, ay, am.s, am.s * 0.44);
    } else {
      ctx.fillStyle = C.heart;
      U.heart(ctx, ax, ay, am.s);
    }
    ctx.fill();
    ctx.restore();
  }
}

function drawFields(ctx: CanvasRenderingContext2D, s: Session, now: number): void {
  const L = s.level;
  for (let yy = 0; yy < L.h; yy++) {
    for (let xx = 0; xx < L.w; xx++) {
      const k = key(xx, yy);
      const px = cx(s, xx);
      const py = cy(s, yy);
      const o = { px, py, cell: s.cell, now, gx: xx, gy: yy };
      if (L.ice.has(k) && !s.renderBroken.has(k)) FLD.ice?.(ctx, o);
      if (s.renderBroken.has(k)) FLD.shards?.(ctx, o);
      if (s.renderFed.has(k)) {
        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = C.heart;
        U.heart(ctx, px - s.cell * 0.12, py + s.cell * 0.05, s.cell * 0.08);
        ctx.fill();
        U.heart(ctx, px + s.cell * 0.14, py - s.cell * 0.1, s.cell * 0.06);
        ctx.fill();
        ctx.restore();
      }
      if (L.noms.has(k) && !s.renderFed.has(k)) {
        SPR.nomster?.(ctx, { x: px, y: py, cell: s.cell, now, chomp: chompScale(s, k, now) });
      }
      if (s.renderStars.has(k)) {
        SPR.star?.(ctx, { x: px, y: py, cell: s.cell, now, r: s.cell * 0.26, seed: xx * 5 + yy, idle: true });
      }
      if (L.sticky.has(k)) FLD.honey?.(ctx, o);
      if (L.oneway.has(k)) FLD.oneway?.(ctx, { ...o, dir: L.oneway.get(k) as Dir4 });
      if (L.split.has(k)) FLD.sparkle?.(ctx, o);
      if (L.portal.has(k)) FLD.portal?.(ctx, o);
      if (L.turn.has(k)) FLD.turner?.(ctx, o);
      if (L.spring.has(k)) FLD.spring?.(ctx, o);
      if (L.breeze.has(k)) FLD.pinwheel?.(ctx, { ...o, dir: L.breeze.get(k) as Dir4 });
      if (L.jelly.has(k)) FLD.jelly?.(ctx, o);
      if (L.walls.has(k)) FLD.wall?.(ctx, o);
    }
  }
  const unlockP = s.heartUnlockT0 === null
    ? undefined
    : Math.min(1, (now - s.heartUnlockT0) / 550);
  FLD.heart?.(ctx, {
    px: cx(s, L.tx), py: cy(s, L.ty), cell: s.cell, now, won: s.winFace,
    locked: s.renderStars.size > 0, unlockP
  });
}

function spriteM(sp: AnimSprite, distE: number): number {
  let m = sp.msteps[0]?.m ?? 1;
  for (let i = 1; i < sp.msteps.length; i++) {
    const st = sp.msteps[i];
    if (st && distE >= st.t) m = st.m;
  }
  return m;
}

function drawAnimSprite(
  ctx: CanvasRenderingContext2D, s: Session, sp: AnimSprite, now: number,
  onFx: (sp: AnimSprite, f: AnimSprite['fxq'][number]['f'], now: number) => void,
  onDone: (sp: AnimSprite, now: number) => void
): boolean {
  let p = Math.min(1, (now - sp.t0) / sp.total);
  if (p < 0) p = 0;
  if (sp.appear) {
    if (p >= 1 && !sp.done) sp.done = true;
    const sc = p < 1 ? 1.25 * p * (2 - p) : 1;
    drawMover(ctx, s, 'dot', sp.lastX, sp.lastY,
      dotR(s, sp.msteps[0]?.m ?? 1) * Math.min(sc, 1.18), 1, 1, 0, 0, 'happy', sp.seed, now, false);
    return p >= 1;
  }
  const distE = easeOC(p) * sp.total;
  for (const fq of sp.fxq) {
    if (!fq.done && distE >= fq.t) {
      fq.done = true;
      onFx(sp, fq.f, now);
    }
  }
  if (p >= 1 && !sp.done) {
    sp.done = true;
    onDone(sp, now);
  }
  if (sp.done && (sp.end === 'merge' || sp.end === 'die' || sp.end === 'feed')) return p >= 1;
  let xN = sp.lastX;
  let yN = sp.lastY;
  let scl = 1;
  let lift = 0;
  let dx = sp.lastDx;
  let dy = sp.lastDy;
  let isTp = false;
  if (sp.segs.length > 0) {
    let rem = distE;
    let seg = sp.segs[sp.segs.length - 1] as AnimSprite['segs'][number];
    let qq = 1;
    for (let s2 = 0; s2 < sp.segs.length; s2++) {
      const cand = sp.segs[s2] as AnimSprite['segs'][number];
      if (rem <= cand.dur || s2 === sp.segs.length - 1) {
        seg = cand;
        qq = Math.min(1, rem / cand.dur);
        break;
      }
      rem -= cand.dur;
    }
    if (seg.tp) {
      isTp = true;
      if (qq < 0.5) {
        xN = seg.x0; yN = seg.y0; scl = Math.max(0.05, 1 - qq * 2);
      } else {
        xN = seg.x1; yN = seg.y1; scl = Math.max(0.05, qq * 2 - 1);
      }
    } else {
      xN = seg.x0 + (seg.x1 - seg.x0) * qq;
      yN = seg.y0 + (seg.y1 - seg.y0) * qq;
      if (seg.hop) lift = Math.sin(qq * Math.PI) * s.cell * 0.55;
      dx = seg.dx;
      dy = seg.dy;
    }
    sp.lastX = xN; sp.lastY = yN; sp.lastDx = dx; sp.lastDy = dy;
  }
  /* balloons never spring — they drift with a lazy sine float */
  if (sp.kind === 'balloon' && !sp.done && !isTp) {
    lift += Math.sin(now * 0.004 + sp.seed) * s.cell * 0.05;
  }
  /* directional squash & stretch — every swipe direction its own motion */
  let tSX = 1;
  let tSY = 1;
  let tRot = 0;
  if (!sp.done && !isTp && sp.kind !== 'balloon' && (dx !== 0 || dy !== 0)) {
    const env = Math.max(0, Math.min(1, Math.min(p / 0.22, (1 - p) / 0.22)));
    if (dx !== 0) {
      tSX = 1 + 0.3 * env; tSY = 1 - 0.18 * env; tRot = dx * 0.19 * env;
      lift += s.cell * 0.14 * env;
    } else if (dy < 0) {
      tSY = 1 + 0.34 * env; tSX = 1 - 0.21 * env; lift += s.cell * 0.1 * env;
    } else {
      tSY = 1 + 0.16 * env; tSX = 1 - 0.09 * env;
    }
  }
  const mNow = spriteM(sp, distE);
  const mod = sp.done
    ? mods(s, key(sp.endCell.x, sp.endCell.y), now)
    : { sx: 1, sy: 1, rot: 0 };
  const kscl = sp.kind !== 'dot' ? scl : 1;
  const asleep = sp.kind === 'panda' && sp.segs.length === 0;
  drawMover(ctx, s, sp.kind, xN, yN - lift, dotR(s, mNow) * scl,
    mod.sx * tSX * kscl, mod.sy * tSY * kscl,
    sp.done ? 0 : dx, sp.done ? 0 : dy,
    asleep ? 'sleepy' : s.ohNoFace ? 'worried' : 'happy',
    sp.seed, now, false, sp.done ? mod.rot : tRot);
  return p >= 1;
}

function drawIdleActors(ctx: CanvasRenderingContext2D, s: Session, now: number): void {
  const lists: Array<[string, { x: number; y: number; m?: number }[], Mood]> = [
    ['box', s.gs.boxes, 'sleepy'],
    ['balloon', s.gs.balloons, 'happy'],
    ['snail', s.gs.snails, 'happy'],
    ['penguin', s.gs.penguins, 'happy'],
    ['bear', s.gs.bears, 'happy'],
    ['ghost', s.gs.ghosts, 'happy'],
    ['bunny', s.gs.bunnies, 'happy'],
    ['frog', s.gs.frogs, 'happy'],
    ['panda', s.gs.pandas, s.gs.parity === 1 ? 'happy' : 'sleepy'],
    ['cat', s.gs.cats, 'happy'],
    ['chick', s.gs.chicks, 'happy'],
    ['pig', s.gs.pigs, 'happy']
  ];
  for (const [kind, list, mood] of lists) {
    for (const p of list) {
      const m = mods(s, key(p.x, p.y), now);
      drawMover(ctx, s, kind, cx(s, p.x), cy(s, p.y), 0, m.sx, m.sy,
        kind === 'snail' ? 1 : 0, 0, mood, p.x * 7 + p.y * 3, now, true, m.rot);
    }
  }
  for (const d of s.gs.dots) {
    const dk = key(d.x, d.y);
    const m = mods(s, dk, now);
    const petted = s.petKey === dk && now - s.petT0 < 900;
    drawMover(ctx, s, 'dot', cx(s, d.x), cy(s, d.y), dotR(s, d.m), m.sx, m.sy, 0, 0,
      s.winFace || petted ? 'joy' : s.ohNoFace ? 'worried' : 'happy',
      d.x * 7 + d.y * 13, now, true, m.rot);
  }
}

function drawHint(ctx: CanvasRenderingContext2D, s: Session, now: number): void {
  if (!s.hintDir) return;
  const age = now - s.hintT0;
  const DUR = 1900;
  let alpha: number;
  if (s.hintMode) {
    /* hint mode: the arrow stays and breathes until toggled off */
    alpha = (age < 200 ? age / 200 : 1) * (0.66 + 0.26 * Math.sin(now * 0.003));
  } else {
    if (age > DUR) {
      s.hintDir = null;
      return;
    }
    alpha = age < 200 ? age / 200 : age > DUR - 400 ? (DUR - age) / 400 : 1;
  }
  const [vx, vy] = DIRS[s.hintDir as Dir];
  const bx = s.ox + (s.cell * s.level.w) / 2;
  const by = s.oy + (s.cell * s.level.h) / 2;
  const slide = ((now * 0.0022) % 1) * s.cell * 0.9;
  ctx.save();
  ctx.globalAlpha = alpha * 0.92;
  ctx.translate(bx + vx * slide, by + vy * slide);
  ctx.rotate(Math.atan2(vy, vx));
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * s.cell * 0.55;
    ctx.strokeStyle = i === 1 ? C.heart : C.bibi;
    ctx.lineWidth = Math.max(6, s.cell * 0.16);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(off - s.cell * 0.22, -s.cell * 0.34);
    ctx.lineTo(off + s.cell * 0.12, 0);
    ctx.lineTo(off - s.cell * 0.22, s.cell * 0.34);
    ctx.stroke();
  }
  ctx.restore();
}

export interface RenderHooks {
  onFx: (sp: AnimSprite, f: AnimSprite['fxq'][number]['f'], now: number) => void;
  onSpriteDone: (sp: AnimSprite, now: number) => void;
  onAnimFinished: () => void;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D, s: Session, now: number, hooks: RenderHooks
): void {
  ctx.clearRect(0, 0, s.cssSize, s.cssSize);
  ctx.save();
  if (s.boardScale < 1) s.boardScale += (1 - s.boardScale) * 0.18;
  const bcx = s.ox + (s.cell * s.level.w) / 2;
  const bcy = s.oy + (s.cell * s.level.h) / 2;
  ctx.translate(bcx, bcy);
  ctx.scale(s.boardScale, s.boardScale);
  ctx.translate(-bcx, -bcy);

  ctx.save();
  ctx.shadowColor = 'rgba(240,120,160,0.28)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = C.panel;
  U.rrect(ctx, s.ox - 10, s.oy - 10, s.cell * s.level.w + 20, s.cell * s.level.h + 20, 24);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.panelLn;
  ctx.lineWidth = 2;
  U.rrect(ctx, s.ox - 10, s.oy - 10, s.cell * s.level.w + 20, s.cell * s.level.h + 20, 24);
  ctx.stroke();

  drawAmbients(ctx, s, now);
  /* pastel checkerboard tiles — the "roads" every piece sits on */
  const inset = 2.5;
  const rad = s.cell * 0.18;
  for (let x = 0; x < s.level.w; x++) {
    for (let y = 0; y < s.level.h; y++) {
      ctx.globalAlpha = (x + y) % 2 === 0 ? 0.55 : 0.9;
      ctx.fillStyle = (x + y) % 2 === 0 ? C.lattice : C.latticeAlt;
      U.rrect(ctx, s.ox + x * s.cell + inset, s.oy + y * s.cell + inset,
        s.cell - inset * 2, s.cell - inset * 2, rad);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  drawFields(ctx, s, now);

  if (s.mode === 'anim') {
    let allDone = true;
    for (const sp of s.sprites) {
      if (!drawAnimSprite(ctx, s, sp, now, hooks.onFx, hooks.onSpriteDone)) allDone = false;
    }
    if (allDone) hooks.onAnimFinished();
  } else {
    drawIdleActors(ctx, s, now);
  }

  /* sinks (eaten squishies spiralling away) + star collect juice */
  for (const pu of s.pulses) {
    const t = (now - pu.t0) / pu.dur;
    if (t > 1 || t < 0) continue;
    if (pu.type === 'sink') {
      drawMover(ctx, s, pu.kind ?? 'dot', pu.x ?? 0, pu.y ?? 0, (pu.r ?? 10) * (1 - t),
        1 - t, 1 - t, 0, 0, 'dizzy', 1, now, false);
    } else if (pu.type === 'soar') {
      /* the collected star floats up, grows and fades */
      const sr = (pu.r ?? s.cell * 0.22) * (1 + 0.45 * t);
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = C.goldStar;
      U.star5(ctx, pu.x ?? 0, (pu.y ?? 0) - t * s.cell * 0.7, sr, sr * 0.44);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (pu.type === 'ring') {
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = C.goldStar;
      ctx.lineWidth = Math.max(2, s.cell * 0.05) * (1 - t * 0.6);
      ctx.beginPath();
      ctx.arc(pu.x ?? 0, pu.y ?? 0, s.cell * (0.2 + 0.5 * t), 0, 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  /* particles */
  for (let pi = s.particles.length - 1; pi >= 0; pi--) {
    const pa = s.particles[pi];
    if (!pa) continue;
    const tp = (now - pa.t0) / pa.dur;
    if (tp > 1) {
      s.particles.splice(pi, 1);
      continue;
    }
    const sec = pa.dur / 1000;
    const px3 = pa.x + pa.vx * tp * sec;
    const py3 = pa.y + pa.vy * tp * sec + s.cell * 1.6 * tp * tp;
    ctx.globalAlpha = 1 - tp;
    ctx.fillStyle = pa.col;
    if (pa.shape === 'heart') {
      U.heart(ctx, px3, py3, pa.s);
      ctx.fill();
    } else if (pa.shape === 'star') {
      U.star5(ctx, px3, py3, pa.s, pa.s * 0.44);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(px3, py3, pa.s / 2, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  drawHint(ctx, s, now);
  s.pulses = s.pulses.filter((pu) => (now - pu.t0) / pu.dur <= 1);
  ctx.restore();
}
