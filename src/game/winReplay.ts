/* Win-card solution replay — re-applies the player's recorded line to a cloned
   initial state via the engine move(), then tweens the squishies between steps
   on a rAF loop, looping forever. The hero dots glide; fields/friends snap at
   each step boundary (they reflect the engine state, so cracked ice, fed noms,
   collected stars and moved friends all show). Draws onto the in-app #winShot
   canvas only — the SHARED PNG stays a clean static board. */
import { CODEDIR, cloneState, makeLevel } from '../engine/core';
import { move } from '../engine/move';
import type { DotPt, GameState, Level, LevelDef } from '../engine/types';
import {
  CARD_H, CARD_W, boardGeom, drawBoardCast, drawBoardFields, drawBoardPanel,
  drawCardChrome, drawCardDot, drawCardFooter
} from './share';

const STEP_MS = 460; /* idealized even tempo per swipe */
const HOLD_MS = 900; /* pause on the solved frame before looping */

interface Frame {
  state: GameState;
  dots: DotPt[];
}

/** Build every board state along the recorded line (initial -> solved). */
function buildFrames(level: Level, line: string): Frame[] {
  const frames: Frame[] = [{ state: level.initState, dots: level.initState.dots }];
  let st = cloneState(level.initState);
  for (const code of line) {
    const dir = CODEDIR[code as keyof typeof CODEDIR];
    if (!dir) continue;
    const res = move(level, st, dir);
    st = res.state;
    frames.push({ state: st, dots: st.dots });
  }
  return frames;
}

/** Nearest dot in `to` to a source dot — pairs heroes across a step for tween. */
function matchDot(src: DotPt, to: DotPt[]): DotPt {
  let best = to[0] ?? src;
  let bestD = Infinity;
  for (const d of to) {
    const dd = (d.x - src.x) ** 2 + (d.y - src.y) ** 2;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

export interface WinReplay {
  stop: () => void;
}

/** Start the looping replay on the given canvas; returns a stop() to clean up.
    `line` is the player's recorded swipe sequence (DirCode string). With reduced
    motion the card paints the solved board once and never animates. */
export function startWinReplay(
  canvas: HTMLCanvasElement, def: LevelDef, label: string, line: string, reduced: boolean
): WinReplay {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { stop: (): void => undefined };
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const level = makeLevel(def);
  const g = boardGeom(level);
  const frames = buildFrames(level, line);
  const cycle = Math.max(1, frames.length - 1) * STEP_MS + HOLD_MS;
  let raf = 0;
  let t0 = 0;
  let stopped = false;

  /** Paint one scene: the static board for `from`, dots tweened toward `to`. */
  const paintScene = (from: Frame, to: Frame, e: number): void => {
    ctx.clearRect(0, 0, CARD_W, CARD_H);
    ctx.save();
    drawCardChrome(ctx, label);
    drawBoardPanel(ctx, level, g);
    drawBoardFields(ctx, level, from.state, g);
    drawBoardCast(ctx, from.state, g);
    for (const d of from.dots) {
      const dst = matchDot(d, to.dots);
      drawCardDot(ctx, g.px(d.x + (dst.x - d.x) * e), g.py(d.y + (dst.y - d.y) * e), g.cell, d.x * 7 + d.y * 13);
    }
    drawCardFooter(ctx);
    ctx.restore();
  };

  const drawAt = (now: number): void => {
    const t = (now - t0) % cycle;
    const i = Math.min(Math.max(0, frames.length - 2), Math.floor(t / STEP_MS));
    const from = frames[i] as Frame;
    const to = frames[Math.min(frames.length - 1, i + 1)] as Frame;
    const local = frames.length < 2 ? 1 : Math.min(1, (t - i * STEP_MS) / STEP_MS);
    paintScene(from, to, 1 - Math.pow(1 - local, 3));
  };

  const tick = (now: number): void => {
    if (stopped) return;
    if (t0 === 0) t0 = now;
    drawAt(now);
    raf = requestAnimationFrame(tick);
  };

  if (reduced) {
    const solved = frames[frames.length - 1] as Frame;
    paintScene(solved, solved, 1);
  } else {
    raf = requestAnimationFrame(tick);
  }

  return {
    stop: (): void => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
    }
  };
}
