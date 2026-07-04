/* Display-ad banners — the cute characters are the HERO, not a sparse board.
   Every curated level fills only ~14% of its grid, so a rendered board always
   looked mostly-empty with tiny characters. Instead the static banners
   hand-compose BIG friend sprites directly (SPR[name], the same painters the
   game uses), on the pastel page wash, under the real "Squishy & Friends"
   wordmark, with one unified claim: "Free • No Ads" + a "Download now" App
   Store CTA. Two square sizes also ship an animated WebP: `gameplay` (real,
   snappy board play) and `bounce` (the hero friends idle-wobbling). The whole
   composition is supersampled (BANNER_DPR) then downscaled once at export — the
   same crispness trick share.ts uses for postcards. */
import { cloneState, CODEDIR, makeLevel } from '../engine/core';
import { move } from '../engine/move';
import type { DirCode, LevelDef } from '../engine/types';
import { SPR } from '../sprites';
import type { Mood } from '../lib/types';
import { bob } from '../lib/draw';
import { drawWordmark } from './logo';
import { drawFrame, type RenderHooks } from './render';
import { shareCanvas } from './share';
import { blankSession, CURATED, type Session } from './session';

export interface BannerSize { key: string; w: number; h: number }
export const BANNER_SIZES: BannerSize[] = [
  { key: '320x50', w: 320, h: 50 },
  { key: '320x100', w: 320, h: 100 },
  { key: '300x250', w: 300, h: 250 },
  { key: '250x250', w: 250, h: 250 }
];

/** A layout style. `parade`/`giant`/`board` are static; `gameplay`/`bounce`
    are animated (WebP). One unified copy across all of them. */
export type Variant = 'parade' | 'giant' | 'board' | 'gameplay' | 'bounce';

export interface BannerCombo { size: string; variant: Variant; animated: boolean }
/** Explicit combo list (NOT size x variant): `animated` follows the variant,
    not the size. Strips only get `parade`; the two squares get all three
    static styles plus both animated ones, so Franz can pick the winner. */
export const BANNER_COMBOS: BannerCombo[] = [
  { size: '320x50', variant: 'parade', animated: true },
  { size: '320x100', variant: 'parade', animated: true },
  { size: '250x250', variant: 'parade', animated: false },
  { size: '250x250', variant: 'giant', animated: false },
  { size: '250x250', variant: 'board', animated: false },
  { size: '250x250', variant: 'bounce', animated: true },
  { size: '250x250', variant: 'gameplay', animated: true },
  { size: '300x250', variant: 'parade', animated: false },
  { size: '300x250', variant: 'giant', animated: false },
  { size: '300x250', variant: 'board', animated: false },
  { size: '300x250', variant: 'gameplay', animated: true },
  { size: '300x250', variant: 'bounce', animated: true }
];

const WEIGHT_CAP_BYTES = 150 * 1024;
/* internal supersample (anti-aliasing) */
const BANNER_DPR = 2;
/* every file is exported at OUTPUT_SCALE x its nominal IAB size, so it stays
   crisp on high-DPI iPhone screens (a 300x250 slot shown @2/@3x upscales a
   nominal-size asset into a blur). Aspect ratios are identical — only the pixel
   density goes up. */
const OUTPUT_SCALE = 2;
const PINK = '#FF6D9E';
const BADGE = 'Free • No Ads';
const CTA = 'Download now';
const NOW0 = 1234;
/* dense, cute, ice-slide-heavy 6x6 (penguin + bunny + frog) — the board/
   gameplay showcase; the board is packed and pieces slide visibly far */
const SHOWCASE_BOARD: LevelDef = CURATED[40] as LevelDef;
const HOOKS: RenderHooks = { onFx: () => undefined, onSpriteDone: () => undefined, onAnimFinished: () => undefined };

interface CastMember { name: string; mood: Mood; seed: number }
/* the friend cast for parade/bounce — squishy (the hero) first, then a cute mix */
const CAST: CastMember[] = [
  { name: 'squishy', mood: 'joy', seed: 1 },
  { name: 'cat', mood: 'happy', seed: 2 },
  { name: 'frog', mood: 'joy', seed: 3 },
  { name: 'penguin', mood: 'happy', seed: 4 },
  { name: 'bunny', mood: 'joy', seed: 5 }
];

function drawFriend(ctx: CanvasRenderingContext2D, m: CastMember, x: number, y: number, r: number, now: number): void {
  SPR[m.name]?.(ctx, { x, y, cell: r / 0.3, r, now, seed: m.seed, idle: true, mood: m.mood });
}

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#FFFAFC');
  bg.addColorStop(1, '#FFE2EE');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
}

function paintCTAPill(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, label: string): void {
  ctx.fillStyle = PINK;
  const r = h / 2;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(h * 0.46)}px Fredoka, ui-rounded, system-ui, sans-serif`;
  ctx.fillText(label, cx, cy + 1, w * 0.9);
}

function paintBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, px: number, maxW: number): void {
  ctx.fillStyle = PINK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(px)}px Fredoka, ui-rounded, system-ui, sans-serif`;
  ctx.fillText(BADGE, cx, cy, maxW);
}

/* ---- board (static `board` + animated `gameplay`) ---------------------- */

/** A Session laid out for a board box of EXACTLY boxPx — keeps the whole board
    on-canvas (not clipped to a quadrant, as the postcard's fixed size would). */
function bannerBoardSession(def: LevelDef, boxPx: number): Session {
  const s = blankSession();
  s.def = def;
  s.level = makeLevel(def);
  s.gs = cloneState(s.level.initState);
  s.renderStars = new Set(s.gs.stars);
  s.cssSize = boxPx;
  const margin = Math.round(boxPx * 0.06);
  const n = Math.max(def.w, def.h);
  s.cell = Math.floor((boxPx - margin) / n);
  s.ox = Math.floor((boxPx - s.cell * def.w) / 2);
  s.oy = Math.floor((boxPx - s.cell * def.h) / 2);
  return s;
}

/** The board's own white card: shadow + hairline border, so the gameplay crop
    reads as a distinct panel against the pink page wash. */
function drawBoardCard(ctx: CanvasRenderingContext2D, board: HTMLCanvasElement, x: number, y: number, boardPx: number): void {
  const pad = Math.round(boardPx * 0.08);
  const size = boardPx + pad * 2;
  const r = size * 0.12;
  ctx.save();
  ctx.shadowColor = 'rgba(200,70,120,0.3)';
  ctx.shadowBlur = size * 0.09;
  ctx.shadowOffsetY = size * 0.045;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, r);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,109,158,0.22)';
  ctx.lineWidth = Math.max(1, size * 0.012);
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, r);
  ctx.stroke();
  ctx.drawImage(board, x + pad, y + pad, boardPx, boardPx);
}

/* ---- layouts ----------------------------------------------------------- */

/** Square layout shared by parade/giant/board/gameplay/bounce: wordmark on
    top, a hero band in the middle (painted by `hero`), badge + CTA at the
    bottom. Every vertical offset is pinned to `h` (both squares share h=250),
    so the two widths never drift out of sync. */
function paintSquare(ctx: CanvasRenderingContext2D, w: number, h: number, hero: (bx: number, by: number, bw: number, bh: number) => void): void {
  const logoW = w * 0.6;
  const logoH = drawWordmark(ctx, w / 2, h * 0.05, logoW);
  const bandTop = h * 0.05 + logoH + h * 0.03;
  const badgeY = h * 0.8;
  const bandBottom = badgeY - h * 0.06;
  hero(w * 0.08, bandTop, w * 0.84, bandBottom - bandTop);
  paintBadge(ctx, w / 2, badgeY, h * 0.062, w - h * 0.1);
  paintCTAPill(ctx, w / 2, h * 0.915, w * 0.66, h * 0.115, CTA);
}

/* cluster positions (fraction of the hero band) — back row of 2, front row of
   3; squishy (index 0) sits front-centre and biggest */
const CLUSTER: { fx: number; fy: number; s: number; i: number }[] = [
  { fx: 0.24, fy: 0.4, s: 0.86, i: 3 },
  { fx: 0.76, fy: 0.4, s: 0.86, i: 4 },
  { fx: 0.14, fy: 0.78, s: 0.96, i: 1 },
  { fx: 0.5, fy: 0.88, s: 1.2, i: 0 },
  { fx: 0.86, fy: 0.78, s: 0.96, i: 2 }
];

/** A bounce frame's place in its loop — `i` of `n`. Drives seamless
    phase-based motion + a staggered blink schedule. */
export interface Anim { i: number; n: number }

const BLINK_PERIOD_S = 3.7;
const BLINK_SEED_K = 0.61;
/** A `now` (ms) that makes the sprite's own blinkOn(seed, now) resolve to
    `blink` — so we can force a real eyes-closed blink on a chosen frame while
    driving all body motion ourselves (idle:false). */
function blinkNow(seed: number, blink: boolean): number {
  const target = blink ? 0.05 : 1.85;
  const a = (((target - seed * BLINK_SEED_K) % BLINK_PERIOD_S) + BLINK_PERIOD_S) % BLINK_PERIOD_S;
  return (a + BLINK_PERIOD_S * 4) * 1000;
}

/** One bouncing friend: phase-based hop + squash + sway (all seamless over the
    loop), plus a 1-frame blink on its scheduled frame. mood 'happy' keeps the
    eyes open + blink-capable (vs the static parade's 'joy' grins). */
function bounceFriend(ctx: CanvasRenderingContext2D, m: CastMember, cx: number, baseY: number, r: number, idx: number, a: Anim): void {
  const ph = (a.i / a.n) * Math.PI * 2 + idx * 1.7;
  const s = 1 + Math.sin(ph * 2 + idx) * 0.055;
  const blink = a.i === (idx * 2 + 1) % a.n;
  SPR[m.name]?.(ctx, {
    x: cx, y: baseY + Math.sin(ph) * r * 0.16, cell: r / 0.3, r, seed: m.seed,
    now: blinkNow(m.seed, blink), idle: false, mood: 'happy',
    sx: s, sy: 1 / s, rot: Math.sin(ph + idx * 0.9) * 0.05
  });
}

function paintCluster(ctx: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number, now: number, anim: Anim | null): void {
  const baseR = bh * 0.3;
  for (const p of CLUSTER) {
    const m = CAST[p.i] as CastMember;
    const r = baseR * p.s;
    const baseY = by + p.fy * bh - r;
    if (anim) bounceFriend(ctx, m, bx + p.fx * bw, baseY, r, p.i, anim);
    else drawFriend(ctx, m, bx + p.fx * bw, baseY, r, now);
  }
}

/** One giant Squishy centre-stage (feet reaching down to the badge, no white
    gap) with two friends peeking at the sides. */
function paintGiant(ctx: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number, now: number): void {
  const cx = bx + bw / 2;
  const bigR = bh * 0.46;
  drawFriend(ctx, CAST[3] as CastMember, bx + bw * 0.15, by + bh - bh * 0.16, bh * 0.21, now);
  drawFriend(ctx, CAST[2] as CastMember, bx + bw * 0.85, by + bh - bh * 0.16, bh * 0.21, now);
  drawFriend(ctx, CAST[0] as CastMember, cx, by + bh - bh * 0.54, bigR, now);
}

const WM_ASPECT = 3620 / 1312;
/** Wordmark width that keeps its height within `maxH` AND within `maxW`. */
function wordmarkW(maxW: number, maxH: number): number {
  return Math.min(maxW, maxH * WM_ASPECT);
}

/** Thin strip (320x50 / 320x100): a friend huddle on the left, the wordmark
    on the right — with badge + CTA stacked under it when tall enough. The
    wordmark is sized by HEIGHT (via wordmarkW) so it never overflows a 50px
    strip and get clipped. */
function paintStrip(ctx: CanvasRenderingContext2D, w: number, h: number, now: number, anim: Anim | null): void {
  const pad = Math.round(h * 0.12);
  const huddleW = w * (h >= 90 ? 0.3 : 0.26);
  const r = h * 0.32;
  const cy = h / 2;
  const friend = (m: CastMember, x: number, fr: number): void => {
    if (anim) bounceFriend(ctx, m, x, cy, fr, m.seed, anim);
    else drawFriend(ctx, m, x, cy + bob(now, m.seed, fr * 0.06), fr, now);
  };
  friend(CAST[1] as CastMember, pad + huddleW * 0.22, r * 0.82);
  friend(CAST[2] as CastMember, pad + huddleW * 0.78, r * 0.82);
  friend(CAST[0] as CastMember, pad + huddleW * 0.5, r);
  const rx = pad + huddleW + pad;
  const rw = w - rx - pad;
  const cx = rx + rw / 2;
  if (h >= 90) {
    const logoTop = h * 0.08;
    const logoH = drawWordmark(ctx, cx, logoTop, wordmarkW(rw * 0.92, h * 0.42));
    const ctaH = h * 0.22;
    const ctaCy = h - pad - ctaH / 2;
    paintBadge(ctx, cx, (logoTop + logoH + (ctaCy - ctaH / 2)) / 2, h * 0.16, rw);
    paintCTAPill(ctx, cx, ctaCy, rw * 0.92, ctaH, CTA);
  } else {
    const wmW = wordmarkW(rw * 0.9, h * 0.62);
    drawWordmark(ctx, cx, (h - wmW / WM_ASPECT) / 2, wmW);
  }
}

/* ---- big-board layout (board + gameplay): the board is the hero ---------- */

/** Board px for the big-board layout — as big as fits full-width with room for
    the CTA strip below; the tilted wordmark overlaps the board (no own band). */
function bigBoardPx(w: number, h: number): number {
  return Math.round(Math.min(h * 0.66, w * 0.8));
}

/** A small tilted "Squishy & Friends" sticker on a soft white card, overlapping
    the top of the board — the wordmark's own white outline plus this backing
    keep it legible over the busy board ("borders to make the contrast right"). */
function drawLogoSticker(ctx: CanvasRenderingContext2D, cx: number, cy: number, wmW: number): void {
  const wmH = wmW / WM_ASPECT;
  const padX = wmW * 0.06;
  const padY = wmH * 0.22;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-6 * Math.PI / 180);
  ctx.save();
  ctx.shadowColor = 'rgba(200,70,120,0.28)';
  ctx.shadowBlur = wmH * 0.45;
  ctx.shadowOffsetY = wmH * 0.12;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-wmW / 2 - padX, -wmH / 2 - padY, wmW + padX * 2, wmH + padY * 2, wmH * 0.45);
  ctx.fill();
  ctx.restore();
  drawWordmark(ctx, 0, -wmH / 2, wmW);
  ctx.restore();
}

/** board/gameplay: a BIG board card centred up top, a tilted wordmark sticker
    overlapping its top, and the badge + CTA in the strip below. */
function paintBigBoard(ctx: CanvasRenderingContext2D, w: number, h: number, board: HTMLCanvasElement): void {
  const boardPx = bigBoardPx(w, h);
  const card = boardPx * 1.16;
  const x = (w - card) / 2;
  const top = h * 0.03;
  drawBoardCard(ctx, board, x, top, boardPx);
  /* small tilted sticker over the TOP-LEFT corner, so most of the big board
     stays visible */
  drawLogoSticker(ctx, x + card * 0.37, top + card * 0.11, card * 0.62);
  const ctaH = h * 0.105;
  const ctaCy = h - ctaH / 2 - h * 0.03;
  paintCTAPill(ctx, w / 2, ctaCy, w * 0.66, ctaH, CTA);
  paintBadge(ctx, w / 2, (top + card + (ctaCy - ctaH / 2)) / 2, h * 0.05, w * 0.9);
}

/* ---- compose (supersample -> downscale once) --------------------------- */

function paintBanner(ctx: CanvasRenderingContext2D, size: BannerSize, variant: Variant, now: number, board: HTMLCanvasElement | null, anim: Anim | null): void {
  ctx.clearRect(0, 0, size.w, size.h);
  paintBackground(ctx, size.w, size.h);
  if (size.h <= 100) { paintStrip(ctx, size.w, size.h, now, anim); return; }
  if (variant === 'board' || variant === 'gameplay') { paintBigBoard(ctx, size.w, size.h, board as HTMLCanvasElement); return; }
  if (variant === 'giant') { paintSquare(ctx, size.w, size.h, (bx, by, bw, bh) => paintGiant(ctx, bx, by, bw, bh, now)); return; }
  paintSquare(ctx, size.w, size.h, (bx, by, bw, bh) => paintCluster(ctx, bx, by, bw, bh, now, anim));
}

function composeBanner(size: BannerSize, variant: Variant, now: number, board: HTMLCanvasElement | null, anim: Anim | null = null): HTMLCanvasElement {
  const outW = size.w * OUTPUT_SCALE;
  const outH = size.h * OUTPUT_SCALE;
  const big = document.createElement('canvas');
  big.width = outW * BANNER_DPR;
  big.height = outH * BANNER_DPR;
  const bctx = big.getContext('2d') as CanvasRenderingContext2D;
  bctx.scale(OUTPUT_SCALE * BANNER_DPR, OUTPUT_SCALE * BANNER_DPR);
  paintBanner(bctx, size, variant, now, board, anim);
  const final = document.createElement('canvas');
  final.width = outW;
  final.height = outH;
  const fctx = final.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  fctx.drawImage(big, 0, 0, outW, outH);
  return final;
}

function checkWeight(bytes: number, file: string): void {
  if (bytes > WEIGHT_CAP_BYTES) {
    throw new Error(`banner ${file} is ${bytes}B, over the ${WEIGHT_CAP_BYTES}B ad-network cap`);
  }
}

/** Render the board image for `board`/`gameplay` (null for character variants).
    Rendered at a generous box and downscaled at draw time, so it stays crisp. */
function boardImage(size: BannerSize, variant: Variant): HTMLCanvasElement | null {
  if (variant !== 'board' && variant !== 'gameplay') return null;
  const boxPx = bigBoardPx(size.w, size.h) * OUTPUT_SCALE;
  const rs = bannerBoardSession(SHOWCASE_BOARD, boxPx);
  const board = shareCanvas(boxPx, boxPx);
  drawFrame(board.ctx, rs, NOW0, HOOKS);
  return board.el;
}

/** One static banner frame -> WebP blob (lossy q92: crisp on the flat pastel
    art, a fraction of a retina-2x PNG's weight). Throws if over the weight cap. */
export async function renderBannerStatic(size: BannerSize, variant: Variant): Promise<Blob> {
  const final = composeBanner(size, variant, NOW0, boardImage(size, variant));
  const blob = await new Promise<Blob | null>((r) => final.toBlob(r, 'image/webp', 0.92));
  if (!blob) throw new Error(`banner ${size.key}/${variant} WebP encode failed`);
  checkWeight(blob.size, `${size.key}-${variant}.webp`);
  return blob;
}

export interface BannerFrame { png: Blob; delay: number }

const GAMEPLAY_MOVES = 5;
const GAMEPLAY_STEP_MS = 430;
const GAMEPLAY_HOLD_MS = 1100;
const BOUNCE_FRAMES = 10;
const BOUNCE_FRAME_DELAY_MS = 130;

async function toFrame(canvas: HTMLCanvasElement, size: BannerSize, variant: Variant, delay: number): Promise<BannerFrame> {
  const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!png) throw new Error(`banner ${size.key}/${variant} frame encode failed`);
  return { png, delay };
}

/** Snappy real gameplay: one frame per distinct board state (move() applies
    instantly), a few moves then a hold. */
async function gameplayFrames(size: BannerSize): Promise<BannerFrame[]> {
  const boxPx = bigBoardPx(size.w, size.h) * OUTPUT_SCALE;
  const rs = bannerBoardSession(SHOWCASE_BOARD, boxPx);
  const board = shareCanvas(boxPx, boxPx);
  const line = (SHOWCASE_BOARD.sol ?? '').split('')
    .filter((ch): ch is DirCode => ch in CODEDIR).slice(0, GAMEPLAY_MOVES);
  const shoot = async (delay: number): Promise<BannerFrame> => {
    drawFrame(board.ctx, rs, NOW0, HOOKS);
    return toFrame(composeBanner(size, 'gameplay', NOW0, board.el), size, 'gameplay', delay);
  };
  const frames: BannerFrame[] = [await shoot(GAMEPLAY_STEP_MS)];
  for (const code of line) {
    const r = move(rs.level, rs.gs, CODEDIR[code]);
    rs.gs = r.state;
    if (r.moved) frames.push(await shoot(GAMEPLAY_STEP_MS));
  }
  const last = frames[frames.length - 1];
  if (last) last.delay = GAMEPLAY_HOLD_MS;
  return frames;
}

/** Bouncing hero friends: a full phase loop (hop + squash + sway, seamless by
    construction) with a staggered per-friend blink. */
async function bounceFrames(size: BannerSize, variant: Variant): Promise<BannerFrame[]> {
  const frames: BannerFrame[] = [];
  for (let i = 0; i < BOUNCE_FRAMES; i++) {
    const canvas = composeBanner(size, variant, NOW0, null, { i, n: BOUNCE_FRAMES });
    frames.push(await toFrame(canvas, size, variant, BOUNCE_FRAME_DELAY_MS));
  }
  return frames;
}

/** Animated frames: `gameplay` steps the board; everything else (the square
    `bounce` and the animated strips) hops + blinks the hero friends. */
export async function renderBannerFrames(size: BannerSize, variant: Variant): Promise<BannerFrame[]> {
  if (variant === 'gameplay') return gameplayFrames(size);
  return bounceFrames(size, variant);
}
