/* The ONE icon painter (SSOT). Every piece icon — on level-picker cards, in the
   builder palette, and on builder board cells — is drawn here by the real
   gameplay SPR/FLD painters into a high-resolution offscreen canvas, cached as a
   data URL and reused as an <img>. Rendering at 4x and letting CSS downscale
   keeps icons crisp at any on-screen size (the cause of the old blur was a tiny
   ~60px source being upscaled into bigger cells). Sprites are NEVER redrawn or
   re-implemented anywhere — callers pass a kind/field name into this. */

import { SPR } from '../sprites';
import { FLD } from '../fields';

/** logical box the painter draws into, and the super-sample factor */
const BOX = 44;
const SUPER = 4;
const cache = new Map<string, string>();

export interface PieceRender { type: 'sprite' | 'field'; name: string; }

/** Paint ONE piece at a cell centre with the real gameplay SPR/FLD painter —
    the single dispatch used by both the icon thumbnails and the live builder
    board, so every piece is drawn exactly as in play (SSOT, no duplication). */
export function paintPiece(
  ctx: CanvasRenderingContext2D, render: PieceRender,
  cx: number, cy: number, cell: number, now = 0
): void {
  if (render.type === 'field') {
    const o = { px: cx, py: cy, cell, now, gx: 0, gy: 0 };
    if (render.name === 'heart') FLD.heart?.(ctx, { ...o, won: false, locked: false });
    else FLD[render.name]?.(ctx, o);
    return;
  }
  SPR[render.name]?.(ctx, { x: cx, y: cy, cell, now, idle: true, mood: 'happy', seed: 3 });
}

export interface IconOpts {
  /** 'sprite' uses SPR[name] (movers/friends/star); 'field' uses FLD[name] */
  kind?: 'sprite' | 'field';
  /** direction for directional fields (oneway / breeze) so the icon points right */
  dir?: 'up' | 'down' | 'left' | 'right';
}

/** Cached high-res data URL for a sprite/field icon (empty for unknown names). */
export function spriteIcon(name: string, opts: IconOpts = {}): string {
  const kind = opts.kind ?? 'sprite';
  const key = kind + ':' + name + ':' + (opts.dir ?? '');
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const c = document.createElement('canvas');
  c.width = c.height = BOX * SUPER;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.scale(SUPER, SUPER);
  /* draw exactly as the game does: the piece sits at the CELL CENTRE with the
     full cell size, so its proportions match play 1:1 (same SSOT painter) */
  const cell = BOX;
  const cx = BOX / 2;
  const cy = BOX / 2;
  if (kind === 'field') {
    const o = { px: cx, py: cy, cell, now: 0, gx: 0, gy: 0, dir: opts.dir };
    if (name === 'heart') FLD.heart?.(ctx, { ...o, won: false, locked: false });
    else FLD[name]?.(ctx, o);
  } else {
    SPR[name]?.(ctx, { x: cx, y: cy, cell, now: 0, idle: true, mood: 'happy', seed: 3 });
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
