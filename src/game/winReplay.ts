/* Win-card solution replay — the player's recorded line re-played through the
   EXACT gameplay pipeline: move() advances the state, buildSprites() builds the
   same animation segments as live play, drawFrame() paints them, and the real
   handleFx/onEnd fire every visual payoff (cracking ice, star soars, merges,
   splits) through silentAudio. One renderer, one animator — the card cannot
   drift from gameplay by construction. Always animated, looping. */
import { CODEDIR, cloneState } from '../engine/core';
import { move } from '../engine/move';
import type { DirCode, LevelDef } from '../engine/types';
import { silentAudio } from './audio';
import { buildSprites, handleFx, onEnd } from './fx';
import { drawFrame, type RenderHooks } from './render';
import type { Session } from './session';
import { BOARD_PX, CARD_H, CARD_W, cardSession, drawCard } from './share';

const STEP_GAP_MS = 340; /* idle beat between replayed swipes */
const HOLD_MS = 1200; /* joy pause on the solved frame before looping */

export interface WinReplay {
  stop: () => void;
}

/** Reset the replay session to the level's initial state for the next loop. */
function rewind(rs: Session): void {
  rs.gs = cloneState(rs.level.initState);
  rs.sprites = [];
  rs.pulses = [];
  rs.particles = [];
  rs.renderBroken = new Set();
  rs.renderFed = new Set();
  rs.renderStars = new Set(rs.gs.stars);
  rs.heartUnlockT0 = null;
  rs.winFace = false;
  rs.combo = 0;
  rs.mode = 'idle';
}

/** Start the looping replay of `line` (DirCode string) on the card canvas. */
export function startWinReplay(
  canvas: HTMLCanvasElement, def: LevelDef, label: string, line: string
): WinReplay {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { stop: (): void => undefined };
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const board = document.createElement('canvas');
  board.width = BOARD_PX;
  board.height = BOARD_PX;
  const bctx = board.getContext('2d') as CanvasRenderingContext2D;
  const rs = cardSession(def);
  const audio = silentAudio();
  const codes = line.split('').filter((c): c is DirCode => c in CODEDIR);
  let idx = 0;
  let nextAt = 0;
  let stopped = false;
  let raf = 0;

  const hooks: RenderHooks = {
    onFx: (sp, f, now) => handleFx(rs, audio, f, now),
    onSpriteDone: (sp, now) => onEnd(rs, audio, sp, now),
    onAnimFinished: (): void => {
      /* the same settle finishMove performs after a live swipe */
      rs.mode = 'idle';
      rs.renderBroken = new Set(rs.gs.broken);
      rs.renderFed = new Set(rs.gs.fed);
      rs.renderStars = new Set(rs.gs.stars);
      const solved = idx >= codes.length;
      if (solved) rs.winFace = true;
      nextAt = performance.now() + (solved ? HOLD_MS : STEP_GAP_MS);
    }
  };

  const step = (now: number): void => {
    if (idx >= codes.length) {
      rewind(rs);
      idx = 0;
      nextAt = now + STEP_GAP_MS;
      return;
    }
    const dir = CODEDIR[codes[idx] as DirCode];
    idx++;
    const r = move(rs.level, rs.gs, dir);
    if (!r.moved) {
      /* the player's no-op swipe replays as an honest still beat */
      nextAt = now + STEP_GAP_MS;
      return;
    }
    rs.sprites = [];
    buildSprites(rs, r.movers, now);
    rs.gs = r.state;
    rs.mode = 'anim';
  };

  const tick = (now: number): void => {
    if (stopped) return;
    if (rs.mode === 'idle' && now >= nextAt) step(now);
    drawFrame(bctx, rs, now, hooks);
    drawCard(ctx, board, label);
    raf = requestAnimationFrame(tick);
  };

  nextAt = performance.now() + STEP_GAP_MS;
  raf = requestAnimationFrame(tick);
  return {
    stop: (): void => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
    }
  };
}
