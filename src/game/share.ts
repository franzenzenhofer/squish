/* Daily share — the viral moment. Renders the daily's STARTING board as a
   cute postcard, shows a congrats modal on solve, and shares result + image
   via the Web Share API (clipboard text fallback). The shared PNG is always a
   clean STATIC board clipped to a rounded rectangle (no cut corners). */
import { key, makeLevel } from '../engine/core';
import type { GameState, LevelDef, Level } from '../engine/types';
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { Dir4 } from '../lib/types';
import { FLD } from '../fields';
import { SPR } from '../sprites';
import { drawWordmark } from './logo';
import { toast } from './toast';

const CARD_W = 640;
const CARD_H = 780;
const CARD_R = 48;
const BOARD_PX = 520;
const FROZEN = 1234; /* frozen moment — deterministic image */
const SITE = 'https://squishy.franzai.com';

/** Where the board sits inside the card — shared by the static image and the
    in-app animated replay so both line up pixel-for-pixel (SSOT geometry). */
export interface BoardGeom {
  cell: number;
  ox: number;
  oy: number;
  px: (x: number) => number;
  py: (y: number) => number;
}

export function boardGeom(level: Level): BoardGeom {
  const n = Math.max(level.w, level.h);
  const cell = Math.floor(BOARD_PX / n);
  const ox = Math.floor((CARD_W - cell * level.w) / 2);
  const oy = 180 + Math.floor((BOARD_PX - cell * level.h) / 2);
  return {
    cell, ox, oy,
    px: (x: number): number => ox + (x + 0.5) * cell,
    py: (y: number): number => oy + (y + 0.5) * cell
  };
}

/** Backdrop: rounded-rect clip, pink wash, wordmark + level label. */
export function drawCardChrome(ctx: CanvasRenderingContext2D, label: string): void {
  U.rrect(ctx, 0, 0, CARD_W, CARD_H, CARD_R);
  ctx.clip();
  /* opaque base first: the radial wash below is non-concentric and leaves the
     corners outside its cone unpainted, which would show as cut corners — the
     base fill keeps the rounded card solid edge to edge */
  ctx.fillStyle = '#FFEFF6';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const bg = ctx.createRadialGradient(CARD_W / 2, -80, 60, CARD_W / 2, CARD_H, CARD_H);
  bg.addColorStop(0, '#FFFAFC');
  bg.addColorStop(0.45, '#FFEFF6');
  bg.addColorStop(1, '#FFE2EE');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  drawWordmark(ctx, CARD_W / 2, 14, 300);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#C18BA8';
  ctx.font = '700 22px Fredoka, ui-rounded, system-ui, sans-serif';
  ctx.fillText(label, CARD_W / 2, 162);
}

/** The board panel + checkerboard tiles. */
export function drawBoardPanel(ctx: CanvasRenderingContext2D, level: Level, g: BoardGeom): void {
  ctx.save();
  ctx.shadowColor = 'rgba(240,120,160,0.28)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = C.panel;
  U.rrect(ctx, g.ox - 12, g.oy - 12, g.cell * level.w + 24, g.cell * level.h + 24, 26);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.panelLn;
  ctx.lineWidth = 2;
  U.rrect(ctx, g.ox - 12, g.oy - 12, g.cell * level.w + 24, g.cell * level.h + 24, 26);
  ctx.stroke();
  for (let x = 0; x < level.w; x++) {
    for (let y = 0; y < level.h; y++) {
      ctx.globalAlpha = (x + y) % 2 === 0 ? 0.55 : 0.9;
      ctx.fillStyle = (x + y) % 2 === 0 ? C.lattice : C.latticeAlt;
      U.rrect(ctx, g.ox + x * g.cell + 2.5, g.oy + y * g.cell + 2.5, g.cell - 5, g.cell - 5, g.cell * 0.18);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

/** Static fields + the heart for the given state (broken/fed/stars respected). */
export function drawBoardFields(
  ctx: CanvasRenderingContext2D, level: Level, gs: GameState, g: BoardGeom
): void {
  const { px, py, cell } = g;
  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      const k = key(x, y);
      const o = { px: px(x), py: py(y), cell, now: FROZEN, gx: x, gy: y };
      if (level.ice.has(k) && !gs.broken.has(k)) FLD.ice?.(ctx, o);
      if (level.noms.has(k) && !gs.fed.has(k)) SPR.nomster?.(ctx, { x: px(x), y: py(y), cell, now: FROZEN });
      if (gs.stars.has(k)) {
        SPR.star?.(ctx, { x: px(x), y: py(y), cell, now: FROZEN, r: cell * 0.26, seed: x * 5 + y, idle: false });
      }
      if (level.sticky.has(k)) FLD.honey?.(ctx, o);
      if (level.oneway.has(k)) FLD.oneway?.(ctx, { ...o, dir: level.oneway.get(k) as Dir4 });
      if (level.split.has(k)) FLD.sparkle?.(ctx, o);
      if (level.portal.has(k)) FLD.portal?.(ctx, o);
      if (level.turn.has(k)) FLD.turner?.(ctx, o);
      if (level.mush.has(k)) FLD.mushroom?.(ctx, o);
      if (level.breeze.has(k)) FLD.pinwheel?.(ctx, { ...o, dir: level.breeze.get(k) as Dir4 });
      if (level.jelly.has(k)) FLD.jelly?.(ctx, o);
      if (level.walls.has(k)) FLD.wall?.(ctx, o);
    }
  }
  FLD.heart?.(ctx, { px: px(level.tx), py: py(level.ty), cell, now: FROZEN, locked: gs.stars.size > 0 });
}

/** Every friend/mover EXCEPT the dots (those are drawn last so the replay can
    animate them at tweened positions). */
export function drawBoardCast(
  ctx: CanvasRenderingContext2D, gs: GameState, g: BoardGeom
): void {
  const { px, py, cell } = g;
  const cast: Array<[string, { x: number; y: number }[]]> = [
    ['box', gs.boxes], ['balloon', gs.balloons], ['snail', gs.snails],
    ['penguin', gs.penguins], ['bear', gs.bears], ['ghost', gs.ghosts],
    ['bunny', gs.bunnies], ['frog', gs.frogs], ['panda', gs.pandas],
    ['cat', gs.cats], ['chick', gs.chicks], ['pig', gs.pigs]
  ];
  for (const [kind, list] of cast) {
    for (const p of list) {
      SPR[kind]?.(ctx, { x: px(p.x), y: py(p.y), cell, now: FROZEN, mood: 'happy', seed: p.x * 7 + p.y, idle: false });
    }
  }
}

/** Draw one squishy at an arbitrary pixel position (replay tween + static). */
export function drawCardDot(
  ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, seed: number
): void {
  SPR.squishy?.(ctx, { x, y, cell, now: FROZEN, r: cell * 0.3, mood: 'happy', seed, idle: false });
}

/** The "Can you solve it?" + site footer line. */
export function drawCardFooter(ctx: CanvasRenderingContext2D): void {
  ctx.textAlign = 'center';
  ctx.fillStyle = C.heart;
  ctx.font = '800 26px Fredoka, ui-rounded, system-ui, sans-serif';
  ctx.fillText('Can you solve it?', CARD_W / 2, CARD_H - 44);
  ctx.fillStyle = '#C18BA8';
  ctx.font = '800 20px Fredoka, ui-rounded, system-ui, sans-serif';
  ctx.fillText('squishy.franzai.com', CARD_W / 2, CARD_H - 14);
}

/** Paint the level's initial state — board, fields, friends — postcard style.
    `label` is the caption under the wordmark (e.g. "Level 12" or "Daily 06-12"). */
export function renderBoardCard(def: LevelDef, label: string): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = CARD_W;
  cv.height = CARD_H;
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  const level = makeLevel(def);
  const g = boardGeom(level);
  const gs = level.initState;
  ctx.save();
  drawCardChrome(ctx, label);
  drawBoardPanel(ctx, level, g);
  drawBoardFields(ctx, level, gs, g);
  drawBoardCast(ctx, gs, g);
  for (const d of gs.dots) drawCardDot(ctx, g.px(d.x), g.py(d.y), g.cell, d.x * 7 + d.y * 13);
  drawCardFooter(ctx);
  ctx.restore();
  return cv;
}

export { CARD_W, CARD_H };

/** Share payload — the level + the open invitation, nothing competitive. */
function shareText(label: string): string {
  return 'Squishy & Friends ' + label + ' - Can you solve it? ' + SITE;
}

/** Share the postcard (image + text) for any solved level; clipboard fallback.
    The copy is the open invitation only — no competitive move count. */
export async function shareCard(def: LevelDef, label: string): Promise<void> {
  const text = shareText(label);
  const cv = renderBoardCard(def, label);
  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/png'));
  const fileName = 'squishy-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
  try {
    if (blob && navigator.canShare?.({ files: [new File([blob], 's.png', { type: 'image/png' })] })) {
      await navigator.share({ text, files: [new File([blob], fileName, { type: 'image/png' })] });
      return;
    }
    if (navigator.share) {
      await navigator.share({ text, url: SITE });
      return;
    }
  } catch {
    /* user cancelled the share sheet — nothing to do */
    return;
  }
  await navigator.clipboard.writeText(text);
  toast('Copied! Paste it anywhere', { ms: 2200 });
}
