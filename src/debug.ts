/* Live debug gallery: every character, state, animation and field on one
   canvas. Each card gets a unique phase/seed so nothing moves in lockstep. */
import { SPR } from './sprites/index';
import { FLD } from './fields/index';
import type { SpriteFn, FieldFn, SpriteOpts, FieldOpts, Dir4, Mood } from './lib/types';

type DrawFn = (cx: number, cy: number, now: number) => void;
type Item = { sec: string } | { label: string; draw: DrawFn };
type PlacedSec = { sec: string; x: number; y: number };
type PlacedCard = { label: string; draw: DrawFn; x: number; y: number };
type Placed = PlacedSec | PlacedCard;

const canvasEl = document.getElementById('c');
if (!(canvasEl instanceof HTMLCanvasElement)) throw new Error('debug: canvas #c missing');
const canvas = canvasEl;
const context = canvas.getContext('2d');
if (!context) throw new Error('debug: 2d context unavailable');
const ctx = context;

function spriteFn(name: string): SpriteFn {
  const fn = SPR[name];
  if (!fn) throw new Error(`debug: unknown sprite "${name}"`);
  return fn;
}
function fieldFn(name: string): FieldFn {
  const fn = FLD[name];
  if (!fn) throw new Error(`debug: unknown field "${name}"`);
  return fn;
}

/* ---- layout grid ---- */
const COLS = 4;
const CW = 200;
const CH = 196;
const PAD = 10;
const HEADH = 40;
const DESIGN_W = COLS * CW;

/* ---- card helpers ---- */
const SC = 150;
let seedN = 0; // gives every card a unique phase

function sprite(name: string, opt: Partial<SpriteOpts> = {}): DrawFn {
  const fn = spriteFn(name);
  const sd = 6 + seedN++ * 1.7;
  return (cx: number, cy: number, now: number): void => {
    const o: SpriteOpts = {
      x: cx, y: cy, r: SC * 0.3, cell: SC, now,
      sx: 1, sy: 1, dx: 0, dy: 0, mood: 'happy', seed: sd, idle: true,
      ...opt,
    };
    fn(ctx, o);
  };
}

function field(name: string, opt: Partial<FieldOpts> = {}): DrawFn {
  const fn = fieldFn(name);
  const n = seedN++;
  return (cx: number, cy: number, now: number): void => {
    const o: FieldOpts = { px: cx, py: cy, cell: SC, now, gx: 1 + n * 1.7, gy: 1 + n * 0.9, ...opt };
    fn(ctx, o);
  };
}

function nom(mood: Mood): DrawFn {
  const fn = spriteFn('nomster');
  return (cx: number, cy: number, now: number): void => {
    fn(ctx, { x: cx, y: cy, cell: SC, now, chomp: 1, mood });
  };
}

/* ---- a looping move demo: shows the squash/stretch + lean per direction ---- */
function moveDemo(dir: Dir4, kind = 'squishy'): DrawFn {
  const fn = spriteFn(kind);
  const mc = 118;
  const off = seedN++ * 280;
  const sd = 3 + off * 0.01;
  return (cx: number, cy: number, now: number): void => {
    const period = 1150;
    const ph = ((now + off) % period) / period;
    let p: number;
    let settling = false;
    let postT = 0;
    if (ph < 0.66) { p = ph / 0.66; } else { p = 1; settling = true; postT = (ph - 0.66) / 0.34; }
    let dx = 0;
    let dy = 0;
    if (dir === 'right') dx = 1; else if (dir === 'left') dx = -1; else if (dir === 'up') dy = -1; else dy = 1;
    const pe = 1 - Math.pow(1 - p, 3);
    const dist = mc * 1.05;
    const posx = cx + dx * (-0.5 + pe) * dist;
    const posy = cy + dy * (-0.5 + pe) * dist;
    let tSX = 1;
    let tSY = 1;
    let tRot = 0;
    let lift = 0;
    if (!settling) {
      const env = Math.max(0, Math.min(1, Math.min(p / 0.22, (1 - p) / 0.22)));
      if (dx !== 0) { tSX = 1 + 0.3 * env; tSY = 1 - 0.18 * env; tRot = dx * 0.19 * env; lift = mc * 0.14 * env; }
      else if (dy < 0) { tSY = 1 + 0.34 * env; tSX = 1 - 0.21 * env; lift = mc * 0.1 * env; }
      else { tSY = 1 + 0.16 * env; tSX = 1 - 0.09 * env; }
    } else {
      const s = Math.sin(Math.min(1, postT / 0.55) * Math.PI);
      const amp = dy > 0 ? 0.36 : (dx !== 0 ? 0.26 : 0.22);
      if (dx !== 0) { tSX += amp * s; tSY -= amp * 0.72 * s; }
      else { tSY += amp * s; tSX -= amp * 0.72 * s; }
    }
    fn(ctx, {
      x: posx, y: posy - lift, r: mc * 0.3, cell: mc, now,
      sx: tSX, sy: tSY, dx, dy, mood: 'happy', seed: sd, rot: tRot, idle: false,
    });
  };
}

/* ---- the catalogue ---- */
const items: Item[] = [
  { sec: 'characters · idle' },
  { label: 'squishy', draw: sprite('squishy') },
  { label: 'marshmallow', draw: sprite('box') },
  { label: 'balloon', draw: sprite('balloon') },
  { label: 'snaily', draw: sprite('snail', { dx: 1 }) },
  { label: 'nomster', draw: nom('idle') },
  { label: 'nomster · fed', draw: nom('feed') },
  { label: 'star (collect all!)', draw: sprite('star') },
  { label: 'panda · sleepy', draw: sprite('panda', { mood: 'sleepy' }) },

  { sec: 'squishy · faces' },
  { label: 'happy', draw: sprite('squishy', { mood: 'happy' }) },
  { label: 'joy (win)', draw: sprite('squishy', { mood: 'joy' }) },
  { label: 'dizzy (eaten)', draw: sprite('squishy', { mood: 'dizzy', idle: false }) },
  { label: 'look ←', draw: sprite('squishy', { mood: 'look', dx: -1 }) },
  { label: 'look →', draw: sprite('squishy', { mood: 'look', dx: 1 }) },
  { label: 'look ↑', draw: sprite('squishy', { mood: 'look', dy: -1 }) },
  { label: 'look ↓', draw: sprite('squishy', { mood: 'look', dy: 1 }) },

  { sec: 'squishy · movement (each swipe is unique)' },
  { label: 'swipe →', draw: moveDemo('right') },
  { label: 'swipe ←', draw: moveDemo('left') },
  { label: 'swipe ↑', draw: moveDemo('up') },
  { label: 'swipe ↓', draw: moveDemo('down') },

  { sec: 'pals · movement' },
  { label: 'marshmallow →', draw: moveDemo('right', 'box') },
  { label: 'balloon →', draw: moveDemo('right', 'balloon') },
  { label: 'snaily →', draw: moveDemo('right', 'snail') },

  { sec: 'fields' },
  { label: 'flower (sticky)', draw: field('honey') },
  { label: 'sparkle (split)', draw: field('sparkle') },
  { label: 'swirl (warp)', draw: field('portal') },
  { label: 'curl (turn)', draw: field('turner') },
  { label: 'spring (bounce)', draw: field('mushroom') },
  { label: 'wind →', draw: field('pinwheel', { dir: 'right' }) },
  { label: 'wind ↑', draw: field('pinwheel', { dir: 'up' }) },
  { label: 'jelly (hop)', draw: field('jelly') },
  { label: 'one-way →', draw: field('oneway', { dir: 'right' }) },
  { label: 'one-way ↑', draw: field('oneway', { dir: 'up' }) },
  { label: 'thin ice', draw: field('ice') },
  { label: 'ice shards', draw: field('shards') },
  { label: 'wall', draw: field('wall') },
  { label: 'heart (goal)', draw: field('heart') },
  { label: 'heart · won', draw: field('heart', { won: true }) },

  { sec: 'friends · all in the game' },
  { label: 'bear', draw: sprite('bear') },
  { label: 'bunny', draw: sprite('bunny') },
  { label: 'chick', draw: sprite('chick') },
  { label: 'kitty', draw: sprite('cat') },
  { label: 'froggy', draw: sprite('frog') },
  { label: 'piggy', draw: sprite('pig') },
  { label: 'panda', draw: sprite('panda') },
  { label: 'penguin', draw: sprite('penguin') },
  { label: 'star', draw: sprite('star') },
  { label: 'ghostie', draw: sprite('ghost') },

  { sec: 'friends · movement' },
  { label: 'bear →', draw: moveDemo('right', 'bear') },
  { label: 'bunny →', draw: moveDemo('right', 'bunny') },
  { label: 'chick →', draw: moveDemo('right', 'chick') },
  { label: 'kitty →', draw: moveDemo('right', 'cat') },
  { label: 'froggy →', draw: moveDemo('right', 'frog') },
  { label: 'piggy →', draw: moveDemo('right', 'pig') },
  { label: 'panda →', draw: moveDemo('right', 'panda') },
  { label: 'penguin →', draw: moveDemo('right', 'penguin') },
  { label: 'star →', draw: moveDemo('right', 'star') },
  { label: 'ghostie →', draw: moveDemo('right', 'ghost') },
];

/* ---- precompute positions ---- */
const placed: Placed[] = [];
let col = 0;
let y = 0;
for (const it of items) {
  if ('sec' in it) {
    if (col > 0) { col = 0; y += CH; }
    placed.push({ sec: it.sec, x: 0, y });
    y += HEADH;
    continue;
  }
  placed.push({ label: it.label, draw: it.draw, x: col * CW, y });
  col++;
  if (col >= COLS) { col = 0; y += CH; }
}
if (col > 0) y += CH;
const DESIGN_H = y + 10;

/* ---- size canvas for crispness, scaled by CSS ---- */
const dpr = Math.min(window.devicePixelRatio || 1, 2);
function size(): void {
  canvas.width = Math.round(DESIGN_W * dpr);
  canvas.height = Math.round(DESIGN_H * dpr);
  canvas.style.height = `${canvas.clientWidth * DESIGN_H / DESIGN_W}px`;
}
window.addEventListener('resize', size);
size();

function roundRect(x: number, w: number, yy: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, yy);
  ctx.arcTo(x + w, yy, x + w, yy + h, r);
  ctx.arcTo(x + w, yy + h, x, yy + h, r);
  ctx.arcTo(x, yy + h, x, yy, r);
  ctx.arcTo(x, yy, x + w, yy, r);
  ctx.closePath();
}

function frame(now: number): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);
  for (const p of placed) {
    if ('sec' in p) {
      ctx.fillStyle = '#C18BA8';
      ctx.font = '800 13px Fredoka, ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.sec.toUpperCase(), 6, p.y + HEADH * 0.62);
      ctx.strokeStyle = 'rgba(246,201,220,.8)';
      ctx.lineWidth = 1.5;
      const tw = ctx.measureText(p.sec.toUpperCase()).width;
      ctx.beginPath();
      ctx.moveTo(16 + tw, p.y + HEADH * 0.62);
      ctx.lineTo(DESIGN_W - 6, p.y + HEADH * 0.62);
      ctx.stroke();
      continue;
    }
    const cardX = p.x + PAD;
    const cardY = p.y + PAD;
    const cw = CW - PAD * 2;
    const chh = CH - PAD * 2;
    ctx.save();
    ctx.shadowColor = 'rgba(240,120,160,0.22)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#fff';
    roundRect(cardX, cw, cardY, chh, 22);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#FBE3EE';
    ctx.lineWidth = 1.5;
    roundRect(cardX, cw, cardY, chh, 22);
    ctx.stroke();

    p.draw(p.x + CW / 2, cardY + chh * 0.44, now);

    ctx.fillStyle = '#8A6076';
    ctx.font = '800 12.5px Fredoka, ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, p.x + CW / 2, cardY + chh - 18);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
