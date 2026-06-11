/* Animation construction + juice: converts engine mover reports into timed
   sprites, fires per-cell effects at the visual moment the sprite reaches
   them, and runs particles/pulses. */
import { key } from '../engine/core';
import type { Fx, MoverReport } from '../engine/types';
import { C } from '../lib/palette';
import type { Audio } from './audio';
import type { AnimSprite, Session } from './session';

export const cx = (s: Session, x: number): number => s.ox + (x + 0.5) * s.cell;
export const cy = (s: Session, y: number): number => s.oy + (y + 0.5) * s.cell;

export function easeOC(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

export function dotR(s: Session, m: number): number {
  return s.cell * 0.3 * Math.min(1 + 0.12 * (Math.log(m) / Math.LN2), 1.42);
}

export function buildSprites(s: Session, movers: MoverReport[], t0: number): void {
  movers.forEach((mv, mi) => {
    const perCell =
      mv.kind === 'snail' ? 100 : mv.kind === 'balloon' ? 88 : mv.kind === 'bear' ? 80 : 46;
    const segs: AnimSprite['segs'] = [];
    const cum = [0];
    for (let i = 1; i < mv.path.length; i++) {
      const a = mv.path[i - 1];
      const b = mv.path[i];
      if (!a || !b) continue;
      const cells = Math.max(1, Math.abs(b.x - a.x) + Math.abs(b.y - a.y));
      const dur = s.instantAnims ? 1 : b.tp ? 120 : b.hop ? 120 + 30 * cells : perCell * cells;
      segs.push({
        x0: cx(s, a.x), y0: cy(s, a.y), x1: cx(s, b.x), y1: cy(s, b.y),
        tp: !!b.tp, hop: !!b.hop, dur,
        dx: Math.sign(b.x - a.x), dy: Math.sign(b.y - a.y)
      });
      cum.push((cum[i - 1] ?? 0) + dur);
    }
    const total = cum[cum.length - 1] || 1;
    const fxq = mv.fx.map((f: Fx) => {
      const seg = segs[f.idx];
      const base = cum[f.idx] ?? 0;
      const t = f.type === 'crack' || f.type === 'split'
        ? base + (seg ? seg.dur * 0.6 : 0)
        : (cum[Math.min(f.idx, cum.length - 1)] ?? 0);
      return { f, t, done: false };
    });
    for (let pi = 1; pi < mv.path.length; pi++) {
      const st = mv.path[pi];
      if (st?.hop) {
        fxq.push({
          f: { type: 'hopfx', cell: st, idx: pi }, t: cum[pi - 1] ?? 0, done: false
        });
      }
    }
    fxq.sort((a, b) => a.t - b.t);
    const msteps = [{ t: -1, m: mv.m0 }];
    let mm = mv.m0;
    for (const q of fxq) {
      if (q.f.type === 'split') {
        mm = Math.max(1, Math.ceil(mm / 2));
        msteps.push({ t: q.t, m: mm });
      }
    }
    const first = mv.path[0];
    if (!first) return;
    s.sprites.push({
      kind: mv.kind, end: mv.end, stick: mv.stick, segs, cum, total, fxq, msteps,
      t0: s.instantAnims
        ? t0
        : t0 + (mv.delayCells ?? 0) * 46 + (mv.kind === 'balloon' ? 90 : 0),
      done: false, seed: mi * 13 + 5,
      lastX: cx(s, first.x), lastY: cy(s, first.y), lastDx: 0, lastDy: 0,
      endCell: mv.path[mv.path.length - 1] ?? first
    });
  });
}

/** Header star counter: visible only on star levels, bounces on collect,
    shows a little open heart when the last star is gone. */
export function updateStarPill(s: Session, bump = false): void {
  const el = document.getElementById('starpill');
  if (!el) return;
  const total = s.level.initState.stars.size;
  el.hidden = total === 0;
  if (total === 0) return;
  el.textContent = s.renderStars.size > 0 ? '★ ' + s.renderStars.size : '♥';
  if (bump) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
}

export function sparkleBurst(s: Session, x: number, y: number, n: number, cols: string[]): void {
  const now = performance.now();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = s.cell * (1.1 + Math.random() * 2.6);
    s.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      t0: now, dur: 300 + Math.random() * 260,
      col: cols[i % cols.length] ?? '#fff', shape: 'dot', s: 2.5 + Math.random() * 3
    });
  }
}

export function heartBurst(s: Session, x: number, y: number, n: number): void {
  const now = performance.now();
  const cols = [C.heart, C.bibi, C.yel, C.portal, C.mint];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = s.cell * (1.3 + Math.random() * 3);
    s.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - s.cell * 0.8,
      t0: now, dur: 400 + Math.random() * 360,
      col: cols[i % 5] ?? C.heart, shape: Math.random() < 0.6 ? 'heart' : 'star',
      s: 4 + Math.random() * 5
    });
  }
}

/** Mid-path effects, fired when the sprite visually reaches them. */
export function handleFx(s: Session, audio: Audio, f: Fx, now: number): void {
  const c = f.cell;
  const px = cx(s, c.x);
  const py = cy(s, c.y);
  const t = f.type;
  if (t === 'crack') {
    s.renderBroken.add(key(c.x, c.y));
    sparkleBurst(s, px, py, 8, [C.ice, C.frost, '#fff']);
    audio.crack();
  } else if (t === 'split') {
    s.sprites.push({
      kind: 'dot', end: 'rest', stick: false, appear: true, t0: now, total: 180, done: false,
      segs: [], cum: [0], fxq: [], msteps: [{ t: -1, m: f.m ?? 1 }],
      seed: 77 + c.x * 7 + c.y,
      lastX: px, lastY: py, lastDx: 0, lastDy: 0, endCell: { x: c.x, y: c.y }
    });
    sparkleBurst(s, px, py, 10, [C.star, C.yel, '#fff']);
    audio.split();
    audio.buzz(8);
  } else if (t === 'beam') {
    s.pulses.push({ type: 'pop', key: key(c.x, c.y), t0: now, dur: 240 });
    sparkleBurst(s, px, py, 6, [C.portal, '#fff']);
    if (f.to) sparkleBurst(s, cx(s, f.to.x), cy(s, f.to.y), 6, [C.portal, '#fff']);
    audio.beam();
  } else if (t === 'turn') {
    sparkleBurst(s, px, py, 5, [C.curl, '#fff']);
    audio.turn();
  } else if (t === 'bounce') {
    s.pulses.push({ type: 'squash', key: key(c.x, c.y), axis: 'y', t0: now, dur: 200 });
    sparkleBurst(s, px, py, 5, [C.mush, '#fff']);
    audio.boing();
  } else if (t === 'wind') {
    sparkleBurst(s, px, py, 6, [C.portal, C.bibi, '#fff']);
    audio.windy();
  } else if (t === 'hopfx') {
    audio.hop();
  } else if (t === 'scare') {
    s.renderFed.add(key(c.x, c.y));
    s.pulses.push({ type: 'pop', key: key(c.x, c.y), t0: now, dur: 320, amp: 0.5 });
    sparkleBurst(s, px, py, 10, [C.nom, C.nomHi, '#fff']);
    audio.scare();
    audio.buzz(10);
  } else if (t === 'shove') {
    s.pulses.push({ type: 'squash', key: key(c.x, c.y), axis: 'x', t0: now, dur: 220, amp: 0.3 });
    audio.oink();
  } else if (t === 'collect') {
    s.renderStars.delete(key(c.x, c.y));
    s.pulses.push({ type: 'soar', x: px, y: py, r: s.cell * 0.24, t0: now, dur: 420 });
    s.pulses.push({ type: 'ring', x: px, y: py, t0: now, dur: 380 });
    s.pulses.push({ type: 'pop', key: key(c.x, c.y), t0: now, dur: 260, amp: 0.4 });
    sparkleBurst(s, px, py, 12, [C.goldStar, C.yel, '#fff']);
    audio.collect();
    audio.buzz(8);
    updateStarPill(s, true);
    if (s.renderStars.size === 0) {
      /* last star — the heart unlocks */
      s.heartUnlockT0 = now;
      heartBurst(s, cx(s, s.level.tx), cy(s, s.level.ty), 14);
      audio.unlockHeart();
    }
  } else if (t === 'catturn') {
    sparkleBurst(s, px, py, 5, [C.heartHi, '#fff']);
    audio.turn();
  }
}

/** End-of-path payoffs: squash, merge hearts, nomster chomp, feeding. */
export function onEnd(s: Session, audio: Audio, sp: AnimSprite, now: number): void {
  const k = key(sp.endCell.x, sp.endCell.y);
  if (sp.appear) return;
  if (sp.end === 'rest') {
    const last = sp.segs[sp.segs.length - 1];
    if (last) {
      const axis = last.dx !== 0 ? 'x' : 'y';
      const amp = last.dy > 0 ? 0.36 : last.dx !== 0 ? 0.26 : 0.22;
      s.pulses.push({ type: 'squash', key: k, axis, t0: now, dur: 200, amp });
    }
    if (sp.stick) {
      audio.squish();
      sparkleBurst(s, sp.lastX, sp.lastY + s.cell * 0.2, 5, [C.honey, C.honeyLn]);
    }
  } else if (sp.end === 'merge') {
    s.combo++;
    s.pulses.push({ type: 'pop', key: k, t0: now, dur: 240, amp: 0.45 });
    heartBurst(s, sp.lastX, sp.lastY, 8 + s.combo * 4);
    audio.merge(s.combo);
    audio.buzz(10);
  } else if (sp.end === 'die') {
    s.pulses.push({ type: 'chomp', key: k, t0: now, dur: 280 });
    s.pulses.push({
      type: 'sink', x: sp.lastX, y: sp.lastY,
      r: dotR(s, sp.msteps[sp.msteps.length - 1]?.m ?? 1),
      t0: now, dur: 220, kind: sp.kind
    });
    sparkleBurst(s, sp.lastX, sp.lastY, 6, [C.bibi, C.bibiLn]);
    audio.nom();
    audio.buzz(12);
  } else if (sp.end === 'feed') {
    s.renderFed.add(k);
    s.pulses.push({ type: 'pop', key: k, t0: now, dur: 280, amp: 0.5 });
    heartBurst(s, sp.lastX, sp.lastY, 10);
    audio.yum();
    audio.buzz(8);
  }
}
