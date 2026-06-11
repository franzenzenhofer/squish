/* Game orchestrator — boot, layout, level flow, move loop. Input, hints,
   endings and the oh-no sequence live in their own modules; this file only
   wires them together around the shared session. */
import { cloneState, isWin, key, makeLevel, ser } from '../engine/core';
import { move } from '../engine/move';
import type { Dir, LevelDef } from '../engine/types';
import { createAssist } from './assist';
import { createAudio } from './audio';
import { createEndings } from './endings';
import { buildSprites, handleFx, onEnd } from './fx';
import { createHints } from './hints';
import { bindInput } from './input';
import { drawFrame, type RenderHooks } from './render';
import { blankSession, loadProgress, saveProgress, type Session } from './session';

const audio = createAudio();
const assist = createAssist();
const s: Session = blankSession();

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const main = document.getElementById('main') as HTMLElement;
const elLvl = document.getElementById('lvl') as HTMLElement;
const elMoves = document.getElementById('moves') as HTMLElement;
const elCap = document.getElementById('cap') as HTMLElement;
const elHintBtn = document.getElementById('hint') as HTMLButtonElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------- layout --------------------------------- */
function layout(): void {
  s.dpr = Math.min(window.devicePixelRatio || 1, 3);
  const pad = 14;
  const aw = main.clientWidth - pad * 2;
  const ah = main.clientHeight - pad * 2 - 24;
  s.cssSize = Math.max(140, Math.floor(Math.min(aw, ah)));
  canvas.style.width = s.cssSize + 'px';
  canvas.style.height = s.cssSize + 'px';
  canvas.width = Math.round(s.cssSize * s.dpr);
  canvas.height = Math.round(s.cssSize * s.dpr);
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  const n = Math.max(s.level.w, s.level.h);
  s.cell = Math.floor((s.cssSize - 18) / n);
  s.ox = Math.floor((s.cssSize - s.cell * s.level.w) / 2);
  s.oy = Math.floor((s.cssSize - s.cell * s.level.h) / 2);
  s.ambients = [];
  for (let i = 0; i < 7; i++) {
    s.ambients.push({
      x: s.ox + Math.random() * s.cell * s.level.w,
      y: s.oy + Math.random() * s.cell * s.level.h,
      v: 5 + Math.random() * 8, ph: Math.random() * 6.3,
      s: 4 + Math.random() * 6, star: Math.random() < 0.4
    });
  }
}

/* ----------------------------- level flow ------------------------------- */
function setCap(txt: string, bad = false): void {
  if (s.capTimer !== null) {
    clearTimeout(s.capTimer);
    s.capTimer = null;
  }
  elCap.classList.toggle('bad', bad);
  elCap.textContent = txt;
  if (txt) {
    elCap.classList.add('show');
    s.capTimer = window.setTimeout(() => elCap.classList.remove('show'), 3600);
  } else {
    elCap.classList.remove('show');
  }
}

function hud(): void {
  const n = s.li + 1;
  elLvl.textContent = (n > 40 ? '∞ ' : '') + String(n).padStart(2, '0');
  elMoves.innerHTML =
    '<b class="' + (s.moves > s.def.par ? 'over' : '') + '">' + s.moves +
    '</b><span class="dim">/' + s.def.par + '</span>';
}

function applyLevel(def: LevelDef): void {
  s.def = def;
  s.level = makeLevel(def);
  s.gs = cloneState(s.level.initState);
  s.renderBroken = new Set();
  s.renderFed = new Set();
  s.renderStars = new Set(s.gs.stars);
  s.moves = 0;
  s.hist = [];
  s.pending = null;
  s.sprites = [];
  s.particles = [];
  s.pulses = [];
  s.mode = 'idle';
  s.combo = 0;
  s.winFace = false;
  s.hintDir = null;
  s.lastMovers = null;
  s.ohNoShown = false;
  setCap(def.cap ?? '');
  layout();
  hud();
  s.boardScale = reduced ? 1 : 0.86;
  const now = performance.now();
  const all = [
    ...s.gs.dots, ...s.gs.boxes, ...s.gs.balloons, ...s.gs.snails,
    ...s.gs.penguins, ...s.gs.bears, ...s.gs.ghosts, ...s.gs.bunnies,
    ...s.gs.frogs, ...s.gs.pandas, ...s.gs.cats, ...s.gs.chicks, ...s.gs.pigs
  ];
  all.forEach((p, j) => {
    s.pulses.push({ type: 'pop', key: key(p.x, p.y), t0: now + 120 + j * 55, dur: 360, amp: 0.42 });
  });
  hints.levelLoaded('lvl:' + s.li);
  assist.prefetch(s.li + 1);
  saveProgress(s);
}

function loadLevel(li: number): void {
  s.li = li;
  s.mode = 'loading';
  void assist.getLevel(li).then((def) => {
    applyLevel(def);
  });
}

/** That swipe made the heart unreachable: say a short "oh no" and
    automatically hop back one move (auto ctrl-z). */
function ohNoJumpBack(): void {
  if (s.ohNoShown || s.mode !== 'idle' || s.hist.length === 0) return;
  s.ohNoShown = true;
  audio.ohno();
  audio.buzz([15, 40, 15]);
  setCap('oh no! that swipe blocked the heart… hopping back', true);
  const frozen = ser(s.gs);
  window.setTimeout(() => {
    s.ohNoShown = false;
    if (ser(s.gs) !== frozen || s.mode !== 'idle') return; // state changed meanwhile
    undo();
    const now = performance.now();
    for (const d of s.gs.dots) {
      s.pulses.push({ type: 'pop', key: key(d.x, d.y), t0: now, dur: 340, amp: 0.45 });
    }
  }, 850);
}

const hints = createHints(s, assist, {
  onUnwinnable: () => ohNoJumpBack(),
  onHintChange: (on) => elHintBtn.classList.toggle('on', on),
  caption: setCap
});

/* ------------------------------ move flow -------------------------------- */
function doMove(dir: Dir): void {
  if (s.mode !== 'idle' && s.mode !== 'anim') return;
  if (s.ohNoShown) return;
  if (s.mode === 'anim') {
    s.pending = dir;
    return;
  }
  const r = move(s.level, s.gs, dir);
  if (!r.moved) {
    audio.tick();
    return;
  }
  s.hist.push({ gs: cloneState(s.gs), moves: s.moves });
  s.moves++;
  audio.slide();
  s.combo = 0;
  s.sprites = [];
  s.hintDir = null;
  buildSprites(s, r.movers, performance.now());
  s.lastMovers = r.movers;
  s.gs = r.state;
  s.mode = 'anim';
  hud();
}

function finishMove(): void {
  s.mode = 'idle';
  s.renderBroken = new Set(s.gs.broken);
  s.renderFed = new Set(s.gs.fed);
  s.renderStars = new Set(s.gs.stars);
  if (isWin(s.level, s.gs)) {
    endings.winSeq();
    return;
  }
  if (s.gs.dots.length === 0) {
    endings.loseSeq();
    return;
  }
  hints.afterStateChange();
  if (s.pending) {
    const d = s.pending;
    s.pending = null;
    doMove(d);
  }
}

function undo(): void {
  if (s.mode !== 'idle' || s.hist.length === 0) return;
  const h = s.hist.pop();
  if (!h) return;
  s.gs = h.gs;
  s.moves = h.moves;
  s.renderBroken = new Set(s.gs.broken);
  s.renderFed = new Set(s.gs.fed);
  s.renderStars = new Set(s.gs.stars);
  s.ohNoShown = false;
  s.hintDir = null;
  audio.tick();
  hud();
  hints.afterStateChange();
}

function retry(): void {
  if (s.mode === 'anim' || s.mode === 'loading') return;
  if (s.winTimer !== null) {
    clearTimeout(s.winTimer);
    s.winTimer = null;
    endings.hideFlood();
  }
  audio.tick();
  void assist.getLevel(s.li).then(applyLevel);
}

/* --------------------------- endings / render ---------------------------- */
const endings = createEndings({
  s, audio, main, canvas, reduced,
  caption: setCap,
  reload: () => void assist.getLevel(s.li).then(applyLevel),
  next: () => loadLevel(s.li + 1)
});

const hooks: RenderHooks = {
  onFx: (_sp, f, now) => handleFx(s, audio, f, now),
  onSpriteDone: (sp, now) => onEnd(s, audio, sp, now),
  onAnimFinished: () => finishMove()
};

function render(now: number): void {
  if (s.mode !== 'loading') drawFrame(ctx, s, now, hooks);
  requestAnimationFrame(render);
}

/* -------------------------------- input ---------------------------------- */
function toggleMute(): void {
  const muted = audio.toggleMute();
  const b = document.getElementById('mute');
  if (b) b.classList.toggle('off', muted);
}

bindInput(main, {
  doMove,
  undo,
  retry,
  hint: () => hints.toggleHintMode(),
  advance: () => endings.advance(),
  toggleMute,
  inWin: () => s.mode === 'win',
  unlockAudio: () => audio.unlock()
});
window.addEventListener('resize', () => layout());

/* --------------------------------- boot ---------------------------------- */
declare global {
  interface Window {
    __move: (d: Dir) => void;
    __goto: (i: number) => void;
    __state: () => { li: number; moves: number; mode: string };
  }
}
window.__move = doMove;
window.__goto = (i: number): void => loadLevel(i);
window.__state = () => ({ li: s.li, moves: s.moves, mode: s.mode });

const progress = loadProgress();
s.results = progress.results;
loadLevel(progress.li);
requestAnimationFrame(render);
