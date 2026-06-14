/* Share — the viral moment. The postcard board (static PNG and the win-card
   replay) is rendered by the ONE gameplay renderer, drawFrame, driven on a
   dedicated card Session: every tile, field and friend looks exactly as it does
   in play, by construction. This module owns only the postcard chrome (rounded
   card, wash, wordmark, label, footer) and the share sheet. */
import { cloneState, makeLevel } from '../engine/core';
import type { LevelDef } from '../engine/types';
import * as U from '../lib/draw';
import { drawWordmark } from './logo';
import { drawFrame, type RenderHooks } from './render';
import { blankSession, type Session } from './session';
import { hideToast, toast } from './toast';

const CARD_W = 640;
const CARD_H = 780;
const CARD_R = 48;
const BOARD_PX = 520;
const BOARD_TOP = 180; /* board square's top edge inside the card */
const FROZEN = 1234; /* frozen moment — deterministic static image */
const SITE = 'https://squishy.franzai.com';
/* shares are supersampled: every card/board canvas is drawn at SHARE_DPR the
   logical size, so sprites/fields stay crisp after the single downscale into
   the final PNG/GIF. Without this the board was painted at 1x then shrunk,
   which is why the old GIF looked soft/broken. */
const SHARE_DPR = 3;

export { BOARD_PX, BOARD_TOP, CARD_H, CARD_W, SHARE_DPR };

/** A canvas whose backing store is SHARE_DPR the logical size, with its context
    pre-scaled so all drawing code keeps using logical coordinates. */
export function shareCanvas(w: number, h: number): {
  el: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
} {
  const el = document.createElement('canvas');
  el.width = Math.round(w * SHARE_DPR);
  el.height = Math.round(h * SHARE_DPR);
  const ctx = el.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.scale(SHARE_DPR, SHARE_DPR);
  return { el, ctx };
}

/** A Session laid out for the postcard's board square — the same structure the
    live game renders, so drawFrame is the single board renderer everywhere. */
export function cardSession(def: LevelDef): Session {
  const s = blankSession();
  s.def = def;
  s.level = makeLevel(def);
  s.gs = cloneState(s.level.initState);
  s.renderStars = new Set(s.gs.stars);
  s.cssSize = BOARD_PX;
  const n = Math.max(def.w, def.h);
  s.cell = Math.floor((BOARD_PX - 18) / n);
  s.ox = Math.floor((BOARD_PX - s.cell * def.w) / 2);
  s.oy = Math.floor((BOARD_PX - s.cell * def.h) / 2);
  return s;
}

/** Hooks for a card render: the postcard has no game flow to notify. */
export const CARD_HOOKS: RenderHooks = {
  onFx: () => undefined,
  onSpriteDone: () => undefined,
  onAnimFinished: () => undefined
};

/** Backdrop: pink wash, wordmark + level label. The on-screen win card clips
    rounded corners; EXPORTED images (PNG/GIF) pass corner 0 — messengers show
    transparent rounded corners as broken, so shares are square and opaque. */
export function drawCardChrome(
  ctx: CanvasRenderingContext2D, label: string, corner = CARD_R
): void {
  if (corner > 0) {
    U.rrect(ctx, 0, 0, CARD_W, CARD_H, corner);
    ctx.clip();
  }
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

/** The "Can you solve it?" + site footer line. */
export function drawCardFooter(ctx: CanvasRenderingContext2D): void {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FF6D9E';
  ctx.font = '800 26px Fredoka, ui-rounded, system-ui, sans-serif';
  ctx.fillText('Can you solve it?', CARD_W / 2, CARD_H - 44);
  ctx.fillStyle = '#C18BA8';
  ctx.font = '800 20px Fredoka, ui-rounded, system-ui, sans-serif';
  ctx.fillText('squishy.franzai.com', CARD_W / 2, CARD_H - 14);
}

/** Compose one full postcard frame: chrome + the board square + footer. */
export function drawCard(
  ctx: CanvasRenderingContext2D, board: HTMLCanvasElement, label: string,
  corner = CARD_R
): void {
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.save();
  drawCardChrome(ctx, label, corner);
  /* explicit logical size so a supersampled board canvas downscales here */
  ctx.drawImage(board, Math.floor((CARD_W - BOARD_PX) / 2), BOARD_TOP, BOARD_PX, BOARD_PX);
  drawCardFooter(ctx);
  ctx.restore();
}

/** The level's initial state as a postcard — board painted by drawFrame at a
    frozen moment, so the static share image IS the gameplay look. */
export function renderBoardCard(def: LevelDef, label: string): HTMLCanvasElement {
  const card = shareCanvas(CARD_W, CARD_H);
  const board = shareCanvas(BOARD_PX, BOARD_PX);
  drawFrame(board.ctx, cardSession(def), FROZEN, CARD_HOOKS);
  /* exported image: square corners, fully opaque */
  drawCard(card.ctx, board.el, label, 0);
  return card.el;
}

/** The landing URL for a share. Daily shares deep-link to #daily so the tap
    drops straight into today's puzzle; everything else opens the campaign. */
function shareUrl(daily: boolean): string {
  return daily ? SITE + '/#daily' : SITE;
}

/** Share payload — the level + the open invitation, nothing competitive. */
function shareText(label: string, daily: boolean): string {
  return 'Squishy & Friends ' + label + ' - Can you solve it? ' + shareUrl(daily);
}

function shareName(label: string, ext: string): string {
  return 'squishy-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.' + ext;
}

/** True when the platform can put this file on its share sheet. */
function canShareFile(file: File): boolean {
  return navigator.canShare?.({ files: [file] }) === true;
}

/** Share a solved level. Preferred: an animated GIF of the first three moves
    fading into the claim card. Fallbacks, in order: the static postcard PNG,
    a plain link share, the clipboard. Exports are square and opaque. */
export async function shareCard(
  def: LevelDef, label: string, line = '', daily = false
): Promise<void> {
  const text = shareText(label, daily);
  let gif: File | null = null;
  if (line) {
    try {
      toast('Making your GIF…', { ms: 8000 });
      const { buildShareGif } = await import('./shareGif');
      gif = new File([buildShareGif(def, label, line)], shareName(label, 'gif'),
        { type: 'image/gif' });
      hideToast();
    } catch (e) {
      console.error('[squishy] share gif failed:', e);
      gif = null;
    }
  }
  const cv = renderBoardCard(def, label);
  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/png'));
  const png = blob ? new File([blob], shareName(label, 'png'), { type: 'image/png' }) : null;
  try {
    if (gif && canShareFile(gif)) {
      await navigator.share({ text, files: [gif] });
      return;
    }
    if (png && canShareFile(png)) {
      await navigator.share({ text, files: [png] });
      return;
    }
    if (navigator.share) {
      await navigator.share({ text, url: shareUrl(daily) });
      return;
    }
  } catch {
    /* user cancelled the share sheet — nothing to do */
    return;
  }
  /* no share sheet (desktop): download the GIF so it is not lost, copy text */
  if (gif) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(gif);
    a.download = gif.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(gif ? 'GIF saved + text copied!' : 'Copied! Paste it anywhere', { ms: 2200 });
  } catch {
    toast(gif ? 'GIF saved!' : 'Sharing is not available here', { ms: 2200 });
  }
}
