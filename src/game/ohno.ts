/* Oh-no — the choreography that plays when a swipe made the heart
   unreachable: the move stands, Squishy shakes its head with a worried face,
   a toast pops ("oh no!"), then every piece visually hops back along an arc
   to where it was and the move is undone for real. */
import { key } from '../engine/core';
import type { GameState } from '../engine/types';
import type { Audio } from './audio';
import { cx, cy, sparkleBurst } from './fx';
import { saveGame } from './persist';
import type { Session } from './session';

const SHAKE_MS = 700;
const RETURN_AT_MS = 850;
const HOP_BASE_MS = 260;
const HOP_PER_CELL_MS = 45;
const HOP_STAGGER_MS = 40;

export interface OhNoDeps {
  s: Session;
  audio: Audio;
  reduced: boolean;
  caption: (txt: string, bad: boolean) => void;
  hud: () => void;
  /** re-check the restored position (re-arms hint mode etc.) */
  afterRestore: () => void;
}

export interface OhNo {
  trigger: () => void;
  /** finishMove hands the completed reverse animation back to us */
  complete: () => void;
}

export function createOhNo(d: OhNoDeps): OhNo {
  const { s, audio } = d;

  /** Bring field visuals (ice, stars, fed nomsters) back to the pre-move
      look, with a little sparkle on every cell that changes back. */
  const restoreFieldVisuals = (prev: GameState): void => {
    for (const k of prev.stars) {
      if (s.renderStars.has(k)) continue;
      s.renderStars.add(k);
      const [x, y] = k.split(',').map(Number) as [number, number];
      sparkleBurst(s, cx(s, x), cy(s, y), 8, ['#FFE493', '#fff']);
    }
    for (const k of [...s.renderBroken]) {
      if (prev.broken.has(k)) continue;
      s.renderBroken.delete(k);
      const [x, y] = k.split(',').map(Number) as [number, number];
      sparkleBurst(s, cx(s, x), cy(s, y), 6, ['#BFE5F4', '#fff']);
    }
    for (const k of [...s.renderFed]) {
      if (prev.fed.has(k)) continue;
      s.renderFed.delete(k);
      const [x, y] = k.split(',').map(Number) as [number, number];
      sparkleBurst(s, cx(s, x), cy(s, y), 6, ['#CBA8E8', '#fff']);
    }
  };

  const complete = (): void => {
    const h = s.hist.pop();
    if (h) {
      s.gs = h.gs;
      s.moves = h.moves;
      s.line.pop();
    }
    s.renderBroken = new Set(s.gs.broken);
    s.renderFed = new Set(s.gs.fed);
    s.renderStars = new Set(s.gs.stars);
    s.sprites = [];
    s.pending = null;
    s.lastMovers = null;
    s.ohNoFace = false;
    s.ohNoShown = false;
    s.ohNoReturn = false;
    s.heartUnlockT0 = null;
    s.mode = 'idle';
    d.hud();
    saveGame(s);
    window.setTimeout(() => {
      d.caption('Squishy hopped back - that way the heart stays reachable', false);
    }, 150);
    d.afterRestore();
  };

  const launchReturn = (): void => {
    if (s.mode !== 'ohno' || !s.ohNoShown) return; // level changed meanwhile
    const h = s.hist[s.hist.length - 1];
    if (!h) {
      complete();
      return;
    }
    restoreFieldVisuals(h.gs);
    if (d.reduced || s.instantAnims || !s.lastMovers) {
      complete();
      return;
    }
    const now = performance.now();
    s.sprites = [];
    let launched = 0;
    s.lastMovers.forEach((mv, mi) => {
      const first = mv.path[0];
      const last = mv.path[mv.path.length - 1];
      if (!first || !last) return;
      const seed = mi * 13 + 5;
      if (mv.path.length <= 1) {
        /* piece that never moved — keep it visible during the reverse */
        s.sprites.push({
          kind: mv.kind, end: 'rest', stick: false, segs: [], cum: [0], total: 1,
          fxq: [], msteps: [{ t: -1, m: mv.m0 }], t0: now, done: false, seed,
          lastX: cx(s, first.x), lastY: cy(s, first.y), lastDx: 0, lastDy: 0,
          endCell: { x: first.x, y: first.y }
        });
        return;
      }
      const cells = Math.abs(first.x - last.x) + Math.abs(first.y - last.y);
      const dur = HOP_BASE_MS + HOP_PER_CELL_MS * Math.max(1, cells);
      s.sprites.push({
        kind: mv.kind, end: 'rest', stick: false,
        segs: [{
          x0: cx(s, last.x), y0: cy(s, last.y), x1: cx(s, first.x), y1: cy(s, first.y),
          tp: false, hop: true, dur,
          dx: Math.sign(first.x - last.x), dy: Math.sign(first.y - last.y)
        }],
        cum: [0, dur], total: dur, fxq: [],
        msteps: [{ t: -1, m: mv.m0 }],
        t0: now + launched * HOP_STAGGER_MS, done: false, seed,
        lastX: cx(s, last.x), lastY: cy(s, last.y), lastDx: 0, lastDy: 0,
        endCell: { x: first.x, y: first.y }
      });
      launched++;
    });
    if (s.sprites.length === 0) {
      complete();
      return;
    }
    s.ohNoReturn = true;
    s.mode = 'anim';
    audio.hop();
  };

  const trigger = (): void => {
    if (s.ohNoShown || s.mode !== 'idle' || s.hist.length === 0) return;
    s.ohNoShown = true;
    s.ohNoFace = true;
    s.mode = 'ohno';
    audio.ohno();
    audio.buzz([15, 40, 15]);
    const now = performance.now();
    for (const dot of s.gs.dots) {
      s.pulses.push({ type: 'shake', key: key(dot.x, dot.y), t0: now, dur: SHAKE_MS, amp: 0.16 });
    }
    window.setTimeout(() => {
      /* speak through the ONE canonical speech bubble (setCap, board-anchored)
         so every Squishy line - oh-no included - shares the same bubble (SSOT) */
      if (s.mode === 'ohno') d.caption("Oh no! That's not a good idea!", true);
    }, 120);
    window.setTimeout(launchReturn, d.reduced || s.instantAnims ? 50 : RETURN_AT_MS);
  };

  return { trigger, complete };
}
