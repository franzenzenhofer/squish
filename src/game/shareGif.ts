/* Share GIF — the first three moves of the solved level played by the EXACT
   gameplay pipeline (move -> buildSprites -> drawFrame on a card session,
   SSOT renderer), then a crossfade to the "Can you solve it?" claim card.
   Frames step on a VIRTUAL clock (drawFrame takes an explicit now), so the
   GIF is deterministic and renders faster than real time. Square corners,
   fully opaque - rounded/transparent shares look broken in messengers. */
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { CODEDIR } from '../engine/core';
import { move } from '../engine/move';
import type { DirCode, LevelDef } from '../engine/types';
import { silentAudio } from './audio';
import { buildSprites, handleFx, onEnd } from './fx';
import { drawFrame, type RenderHooks } from './render';
import {
  BOARD_PX, CARD_H, CARD_W, cardSession, drawCard, drawCardChrome
} from './share';

const FPS = 12;
const DT = Math.round(1000 / FPS);
const STEP_GAP_MS = 340;
const MOVES_SHOWN = 3;
const SETTLE_FRAMES = 4;
const FADE_FRAMES = 8;
const CLAIM_HOLD_FRAMES = 12;
const MAX_FRAMES = 90; /* hard ceiling — a stuck animation must not loop forever */
/* GIF output scale: 0.65 of the postcard keeps shares ~1-2MB */
const GIF_W = 416;
const GIF_H = 507;

/** The closing claim card: wordmark + a big invitation. */
function drawClaimCard(ctx: CanvasRenderingContext2D, label: string): void {
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.save();
  drawCardChrome(ctx, label, 0);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FF6D9E';
  ctx.font = '800 56px Fredoka, ui-rounded, system-ui, sans-serif';
  ctx.fillText('Can you', CARD_W / 2, CARD_H * 0.42);
  ctx.fillText('solve it?', CARD_W / 2, CARD_H * 0.42 + 70);
  /* a big heart, the game's goal */
  ctx.fillStyle = '#FF6D9E';
  const hx = CARD_W / 2;
  const hy = CARD_H * 0.62;
  const hs = 60;
  ctx.beginPath();
  ctx.moveTo(hx, hy + hs * 0.9);
  ctx.bezierCurveTo(hx - hs * 1.3, hy, hx - hs * 0.8, hy - hs * 0.9, hx, hy - hs * 0.25);
  ctx.bezierCurveTo(hx + hs * 0.8, hy - hs * 0.9, hx + hs * 1.3, hy, hx, hy + hs * 0.9);
  ctx.fill();
  /* the headline IS the claim — the footer shows only the site */
  ctx.fillStyle = '#C18BA8';
  ctx.font = '800 22px Fredoka, ui-rounded, system-ui, sans-serif';
  ctx.fillText('squishy.franzai.com', CARD_W / 2, CARD_H - 24);
  ctx.restore();
}

/** Render the share GIF for a level + the player's line. Pure CPU work on a
    virtual clock; resolves to a GIF blob (or throws if encoding fails). */
export function buildShareGif(def: LevelDef, label: string, line: string): Blob {
  const card = document.createElement('canvas');
  card.width = CARD_W;
  card.height = CARD_H;
  const cctx = card.getContext('2d') as CanvasRenderingContext2D;
  const board = document.createElement('canvas');
  board.width = BOARD_PX;
  board.height = BOARD_PX;
  const bctx = board.getContext('2d') as CanvasRenderingContext2D;
  const out = document.createElement('canvas');
  out.width = GIF_W;
  out.height = GIF_H;
  const octx = out.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;

  const rs = cardSession(def);
  const audio = silentAudio();
  const codes = line.split('')
    .filter((c): c is DirCode => c in CODEDIR)
    .slice(0, MOVES_SHOWN);
  let idx = 0;
  let nextAt = STEP_GAP_MS;
  let movesSettled = 0;

  const hooks: RenderHooks = {
    onFx: (_sp, f, now) => handleFx(rs, audio, f, now),
    onSpriteDone: (sp, now) => onEnd(rs, audio, sp, now),
    onAnimFinished: (): void => {
      rs.mode = 'idle';
      rs.renderBroken = new Set(rs.gs.broken);
      rs.renderFed = new Set(rs.gs.fed);
      rs.renderStars = new Set(rs.gs.stars);
      movesSettled++;
    }
  };

  const step = (now: number): void => {
    const dir = CODEDIR[codes[idx] as DirCode];
    idx++;
    const r = move(rs.level, rs.gs, dir);
    if (!r.moved) {
      movesSettled++;
      return;
    }
    rs.sprites = [];
    buildSprites(rs, r.movers, now);
    rs.gs = r.state;
    rs.mode = 'anim';
  };

  /* phase 1: play the first moves on the virtual clock, capturing frames */
  const frames: ImageData[] = [];
  const capture = (): void => {
    octx.drawImage(card, 0, 0, GIF_W, GIF_H);
    frames.push(octx.getImageData(0, 0, GIF_W, GIF_H));
  };

  let t = 0;
  let settleLeft = SETTLE_FRAMES;
  while (frames.length < MAX_FRAMES) {
    if (rs.mode === 'idle' && idx < codes.length && t >= nextAt) {
      step(t);
      nextAt = t + STEP_GAP_MS;
    }
    drawFrame(bctx, rs, t, hooks);
    drawCard(cctx, board, label, 0);
    capture();
    t += DT;
    if (movesSettled >= codes.length && rs.mode === 'idle') {
      if (settleLeft-- <= 0) break;
    }
  }

  /* phase 2: crossfade to the claim card, then hold */
  const lastPlay = document.createElement('canvas');
  lastPlay.width = CARD_W;
  lastPlay.height = CARD_H;
  (lastPlay.getContext('2d') as CanvasRenderingContext2D).drawImage(card, 0, 0);
  const claim = document.createElement('canvas');
  claim.width = CARD_W;
  claim.height = CARD_H;
  drawClaimCard(claim.getContext('2d') as CanvasRenderingContext2D, label);
  for (let i = 1; i <= FADE_FRAMES; i++) {
    cctx.globalAlpha = 1;
    cctx.drawImage(lastPlay, 0, 0);
    cctx.globalAlpha = i / FADE_FRAMES;
    cctx.drawImage(claim, 0, 0);
    cctx.globalAlpha = 1;
    capture();
  }
  for (let i = 0; i < CLAIM_HOLD_FRAMES; i++) {
    cctx.drawImage(claim, 0, 0);
    capture();
  }

  /* encode: one shared palette from a mid-play frame keeps colors stable */
  const enc = GIFEncoder();
  const sample = frames[Math.floor(frames.length / 3)] ?? frames[0];
  if (!sample) throw new Error('share gif rendered no frames');
  const palette = quantize(sample.data, 256);
  frames.forEach((f, i) => {
    enc.writeFrame(applyPalette(f.data, palette), GIF_W, GIF_H, {
      palette, delay: DT, ...(i === 0 ? { repeat: 0 } : {})
    });
  });
  enc.finish();
  return new Blob([enc.bytes() as BlobPart], { type: 'image/gif' });
}
