/* Game orchestrator — DOM, input, move flow, win/lose, hint, oh-no, boot. */
import { cloneState, isWin, key, makeLevel, ser } from '../engine/core';
import { move } from '../engine/move';
import type { Dir, LevelDef } from '../engine/types';
import { createAssist } from './assist';
import { createAudio } from './audio';
import { buildSprites, cx, cy, handleFx, heartBurst, onEnd } from './fx';
import { drawFrame, type RenderHooks } from './render';
import { blankSession, loadProgress, saveProgress, type Session } from './session';

const WINWORDS = ['sweet!', 'yay!', 'lovely!', 'cutie!', 'aww!', 'hooray!'];

const audio = createAudio();
const assist = createAssist();
const s: Session = blankSession();

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const main = document.getElementById('main') as HTMLElement;
const elLvl = document.getElementById('lvl') as HTMLElement;
const elMoves = document.getElementById('moves') as HTMLElement;
const elCap = document.getElementById('cap') as HTMLElement;
const elFlood = document.getElementById('flood') as HTMLElement;
const elMsg = document.getElementById('msg') as HTMLElement;
const elMsgBig = document.getElementById('msgbig') as HTMLElement;
const elMsgSub = document.getElementById('msgsub') as HTMLElement;
const elOhno = document.getElementById('ohno') as HTMLElement;
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
  s.solution = null;
  s.solutionFor = null;
  s.hintDir = null;
  s.ohNoShown = false;
  hideOhNo();
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
  /* seed the hint/oh-no pipeline with the opening solution */
  s.solution = null;
  scheduleCheck();
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

/* --------------------------- solvability/hints --------------------------- */
function scheduleCheck(): void {
  s.solutionFor = null;
  assist.checkState(
    s,
    () => {
      showOhNo();
    },
    (sol) => {
      s.solution = sol;
      s.solutionFor = ser(s.gs);
    }
  );
}

function showOhNo(): void {
  if (s.ohNoShown || s.mode === 'win') return;
  s.ohNoShown = true;
  audio.ohno();
  audio.buzz([15, 40, 15]);
  elOhno.classList.add('show');
}

function hideOhNo(): void {
  s.ohNoShown = false;
  elOhno.classList.remove('show');
}

function showHint(): void {
  if (s.mode !== 'idle' || s.ohNoShown) return;
  audio.unlock();
  const k = ser(s.gs);
  if (s.solution && s.solution.length > 0 && s.solutionFor === k) {
    const d = s.solution[0] as Dir;
    s.hintDir = d;
    s.hintT0 = performance.now();
    audio.tick();
    return;
  }
  if (s.hintBusy) return;
  s.hintBusy = true;
  elHintBtn.classList.add('busy');
  assist.requestHint(s, (sol) => {
    s.hintBusy = false;
    elHintBtn.classList.remove('busy');
    if (ser(s.gs) !== k) return;
    if (sol && sol.length > 0) {
      s.solution = sol;
      s.solutionFor = k;
      s.hintDir = sol[0] as Dir;
      s.hintT0 = performance.now();
      audio.tick();
    } else {
      setCap('no hint right now…', true);
    }
  });
}

/* ------------------------------ move flow -------------------------------- */
function doMove(dir: Dir): void {
  if (s.mode === 'win' || s.mode === 'lose' || s.mode === 'loading') return;
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
  /* fast-path the cached solution */
  if (s.solution && s.solutionFor === ser(s.gs) && s.solution[0] === dir) {
    s.solution = s.solution.slice(1);
    s.solutionFor = ser(r.state);
  } else {
    s.solution = null;
    s.solutionFor = null;
  }
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
    winSeq();
    return;
  }
  if (s.gs.dots.length === 0) {
    loseSeq();
    return;
  }
  if (s.solutionFor !== ser(s.gs)) s.solution = null;
  if (!s.solution) scheduleCheck();
  if (s.pending) {
    const d = s.pending;
    s.pending = null;
    doMove(d);
  }
}

function undo(): void {
  if ((s.mode !== 'idle' && !s.ohNoShown) || s.hist.length === 0) return;
  const h = s.hist.pop();
  if (!h) return;
  s.gs = h.gs;
  s.moves = h.moves;
  s.renderBroken = new Set(s.gs.broken);
  s.renderFed = new Set(s.gs.fed);
  s.renderStars = new Set(s.gs.stars);
  s.mode = 'idle';
  hideOhNo();
  audio.tick();
  hud();
  s.solution = null;
  scheduleCheck();
}

function retry(): void {
  if (s.mode === 'anim' || s.mode === 'loading') return;
  if (s.winTimer !== null) {
    clearTimeout(s.winTimer);
    s.winTimer = null;
    hideFlood();
  }
  audio.tick();
  void assist.getLevel(s.li).then(applyLevel);
}

/* ------------------------------ win / lose ------------------------------- */
function floodAt(px: number, py: number): void {
  const r = canvas.getBoundingClientRect();
  const mr = main.getBoundingClientRect();
  const x = r.left - mr.left + px;
  const y = r.top - mr.top + py;
  elFlood.style.transition = 'none';
  elFlood.style.clipPath = 'circle(0px at ' + x + 'px ' + y + 'px)';
  void elFlood.offsetWidth;
  elFlood.style.transition = reduced ? 'none' : 'clip-path .36s cubic-bezier(.2,.7,.3,1)';
  elFlood.style.clipPath = 'circle(150% at ' + x + 'px ' + y + 'px)';
}

function hideFlood(): void {
  elFlood.style.transition = 'none';
  elFlood.style.clipPath = 'circle(0px at 50% 50%)';
  elMsg.classList.remove('show');
}

function ratingHearts(n: number): string {
  let h = '';
  for (let i = 0; i < 3; i++) {
    h += '<svg class="rh ' + (i < n ? 'on' : '') + '" viewBox="0 0 32 30"><path d="M16 27 C4 18 3 10 8.5 7.5 C12.5 5.7 16 9 16 12 C16 9 19.5 5.7 23.5 7.5 C29 10 28 18 16 27 Z"/></svg>';
  }
  return '<div class="rate">' + h + '</div>';
}

function winSeq(): void {
  s.mode = 'win';
  s.winFace = true;
  audio.win();
  audio.buzz(30);
  s.pulses.push({ type: 'pop', key: s.level.target, t0: performance.now(), dur: 420, amp: 0.55 });
  heartBurst(s, cx(s, s.level.tx), cy(s, s.level.ty), 28);
  const prev = s.results[s.li];
  if (prev === undefined || s.moves < prev) s.results[s.li] = s.moves;
  saveProgress(s);
  const stars = s.moves <= s.def.par ? 3 : s.moves <= s.def.par + 1 ? 2 : 1;
  setTimeout(() => {
    floodAt(cx(s, s.level.tx), cy(s, s.level.ty));
    elMsgBig.textContent = WINWORDS[Math.floor(Math.random() * WINWORDS.length)] ?? 'sweet!';
    elMsgSub.innerHTML = ratingHearts(stars);
    setTimeout(() => elMsg.classList.add('show'), reduced ? 0 : 220);
    s.winTimer = window.setTimeout(advance, 1250);
  }, reduced ? 0 : 440);
}

function advance(): void {
  if (s.winTimer !== null) {
    clearTimeout(s.winTimer);
    s.winTimer = null;
  }
  hideFlood();
  loadLevel(s.li + 1);
}

function loseSeq(): void {
  s.mode = 'lose';
  audio.buzz([15, 40, 15]);
  setCap('nom! a nomster ate your last squishy', true);
  if (!reduced) main.classList.add('shake');
  setTimeout(() => {
    main.classList.remove('shake');
    void assist.getLevel(s.li).then(applyLevel);
  }, 700);
}

/* ------------------------------ render loop ------------------------------ */
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
let pStart: { x: number; y: number } | null = null;
let pFired = false;

function fireSwipe(dx: number, dy: number): void {
  doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
}

main.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pStart = { x: e.clientX, y: e.clientY };
  pFired = false;
});
main.addEventListener('pointermove', (e) => {
  if (!pStart || pFired) return;
  const dx = e.clientX - pStart.x;
  const dy = e.clientY - pStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
  pFired = true;
  fireSwipe(dx, dy);
});
main.addEventListener('pointerup', (e) => {
  if (s.mode === 'win') {
    if (!pFired) advance();
    pStart = null;
    return;
  }
  if (pStart && !pFired) {
    const dx = e.clientX - pStart.x;
    const dy = e.clientY - pStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 16) fireSwipe(dx, dy);
  }
  pStart = null;
});
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  audio.unlock();
  const map: Record<string, Dir> = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right'
  };
  if (s.mode === 'win' && (e.key === ' ' || e.key === 'Enter')) {
    advance();
    return;
  }
  const d = map[e.key];
  if (d) {
    e.preventDefault();
    doMove(d);
  } else if (e.key === 'u') undo();
  else if (e.key === 'r') retry();
  else if (e.key === 'h') showHint();
  else if (e.key === 'm') toggleMute();
});

function bind(id: string, fn: () => void): void {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', () => {
      audio.unlock();
      fn();
    });
  }
}
bind('undo', undo);
bind('retry', retry);
bind('hint', showHint);
bind('ohno-undo', undo);
bind('ohno-retry', retry);

function toggleMute(): void {
  const muted = audio.toggleMute();
  const b = document.getElementById('mute');
  if (b) b.classList.toggle('off', muted);
}
bind('mute', toggleMute);
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
loadLevel(progress.li);
s.results = progress.results;
requestAnimationFrame(render);
