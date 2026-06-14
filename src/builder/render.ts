/* Builder board rendering — reuses the GAME's renderer wholesale: a card
   Session built by the existing cardSession() is painted by the one drawFrame()
   onto the editor canvas, so the editor board IS the gameplay board, pixel for
   pixel (SSOT, no second renderer). Empty-cell tiles are a CSS backdrop behind
   the transparent canvas, so no tile drawing is duplicated here either. */

import { drawFrame, drawBoardBackdrop, applyBoardScale } from '../game/render';
import { cardSession, CARD_HOOKS, BOARD_PX } from '../game/share';
import { toDef, type BuilderState } from './state';
import type { Session } from '../game/session';

export interface BoardMetrics { cell: number; ox: number; oy: number; }

/** Cell/offset math — identical to cardSession()/layout(), in BOARD_PX space. */
export function boardMetrics(w: number, h: number): BoardMetrics {
  const n = Math.max(w, h);
  const cell = Math.floor((BOARD_PX - 18) / n);
  return { cell, ox: Math.floor((BOARD_PX - cell * w) / 2), oy: Math.floor((BOARD_PX - cell * h) / 2) };
}

/** A render-only game Session for the current board — ALWAYS built, so the
    editor board IS the gameplay board (same cardSession layout as the live game
    and the share card). An empty board (no heart) renders only the backdrop. */
export function builderSession(st: BuilderState): Session {
  return cardSession(toDef(st));
}

/** Paint the board with the ONE gameplay renderer at BOARD_PX (CSS downscales).
    With a heart it is the full drawFrame (panel + tiles + pieces); empty it is
    just the shared board backdrop — never a duplicate CSS card/tile grid. */
export function drawBuilder(
  canvas: HTMLCanvasElement, session: Session, now: number, hasHeart: boolean
): void {
  if (canvas.width !== BOARD_PX) { canvas.width = BOARD_PX; canvas.height = BOARD_PX; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (hasHeart) { drawFrame(ctx, session, now, CARD_HOOKS); return; }
  ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);
  ctx.save();
  applyBoardScale(ctx, session);
  drawBoardBackdrop(ctx, session, now);
  ctx.restore();
}

/** Map a pointer position over the canvas to a board cell (or null if outside). */
export function cellFromPoint(
  canvas: HTMLCanvasElement, clientX: number, clientY: number, w: number, h: number
): [number, number] | null {
  const r = canvas.getBoundingClientRect();
  if (r.width === 0) return null;
  const m = boardMetrics(w, h);
  const lx = ((clientX - r.left) / r.width) * BOARD_PX;
  const ly = ((clientY - r.top) / r.height) * BOARD_PX;
  const x = Math.floor((lx - m.ox) / m.cell);
  const y = Math.floor((ly - m.oy) / m.cell);
  return x >= 0 && y >= 0 && x < w && y < h ? [x, y] : null;
}
