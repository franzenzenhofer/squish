/* Game orchestrator — boot, layout, level flow, move loop. Input, hints,
   endings and the oh-no sequence live in their own modules; this file only
   wires them together around the shared session. */
import { DIRCODE, cloneState, isWin, key, makeLevel } from '../engine/core';
import { move } from '../engine/move';
import type { Dir, LevelDef } from '../engine/types';
import { createAssist } from './assist';
import { createAudio } from './audio';
import { createEndings } from './endings';
import { buildSprites, cx, cy, handleFx, onEnd } from './fx';
import { drainFlood, fadeSwap } from './transition';
import { createHints } from './hints';
import { bindInput } from './input';
import { createIntro } from './intro';
import { localToday } from '../gen/daily';
import { createOhNo } from './ohno';
import { createLevelsPick } from './levelsPick';
import { loadGame, replayLine, restoreReplay, sameDef, saveGame } from './persist';
import { createDailyWin } from './share';
import { createStart } from './start';
import { HEART_SVG, mountWordmark } from './logo';
import { hideToast, toast } from './toast';
import { drawFrame, type RenderHooks } from './render';
import { CURATED, blankSession, type Session } from './session';
import { installTestApi } from './testapi';

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
const elFooter = document.querySelector('footer') as HTMLElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* mount the one-and-only logo (SSOT) into the header heart-home + wordmark */
const elHome = document.getElementById('home');
if (elHome) elHome.innerHTML = HEART_SVG;
const elLogo = document.getElementById('logo');
if (elLogo) mountWordmark(elLogo);

/* ------------------------------- layout --------------------------------- */
function layout(): void {
  s.dpr = Math.min(window.devicePixelRatio || 1, 3);
  const pad = 14;
  const aw = main.clientWidth - pad * 2;
  /* the board fills the play area and sits dead-centre; messages float on top */
  const ah = main.clientHeight - pad * 2;
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

function oracleKey(): string {
  return s.play.kind === 'daily' ? 'daily:' + s.play.date : 'lvl:' + s.li;
}

function hud(): void {
  const n = s.li + 1;
  /* one continuous ladder: plain numbers forever */
  elLvl.textContent = s.play.kind === 'daily' ? 'Daily' : String(n).padStart(2, '0');
  elMoves.innerHTML =
    '<b class="' + (s.moves > s.def.par ? 'over' : '') + '">' + s.moves +
    '</b><span class="dim">/' + s.def.par + '</span>';
  /* teach the tools on the first few levels, then go icon-only */
  if (elFooter) elFooter.classList.toggle('labels', s.play.kind === 'campaign' && s.li < 3);
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
  s.line = [];
  s.pending = null;
  s.sprites = [];
  s.particles = [];
  s.pulses = [];
  s.mode = 'idle';
  s.combo = 0;
  s.winFace = false;
  s.hintDir = null;
  /* hint mode is per-level: each level starts in normal mode */
  s.hintMode = false;
  elHintBtn.classList.remove('on');
  s.lastMovers = null;
  s.ohNoShown = false;
  s.ohNoFace = false;
  s.ohNoReturn = false;
  s.heartUnlockT0 = null;
  hideToast();
  dailyWin.hide();
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
  hints.levelLoaded(oracleKey());
  if (s.play.kind === 'campaign') assist.prefetch(s.li + 1);
  saveGame(s);
  /* first-meet cards greet new friends/elements only once the player is
     actually in the level — never behind the start menu, where the 7s
     auto-dismiss would burn them unseen. The menu fires them on Play. */
  if (startMenu.isOpen()) s.mode = 'menu';
  else intro.maybeShow(s);
}

function loadLevel(li: number, fromWin = false): void {
  s.li = li;
  s.play = { kind: 'campaign' };
  s.mode = 'loading';
  const defP = assist.getLevel(li);
  if (fromWin) {
    /* the screen is flooded pink — apply beneath, then drain into the new heart */
    void defP.then((def) => {
      applyLevel(def);
      const r = canvas.getBoundingClientRect();
      const mr = main.getBoundingClientRect();
      drainFlood(reduced, r.left - mr.left + cx(s, s.level.tx), r.top - mr.top + cy(s, s.level.ty));
    });
    return;
  }
  fadeSwap(reduced, async () => applyLevel(await defP));
}

const ohno = createOhNo({
  s, audio, reduced,
  caption: setCap,
  hud,
  afterRestore: () => hints.afterStateChange()
});

const hints = createHints(s, assist, {
  onUnwinnable: () => ohno.trigger(),
  onHintChange: (on) => elHintBtn.classList.toggle('on', on),
  caption: setCap
});

/* ------------------------------ move flow -------------------------------- */
function doMove(dir: Dir): void {
  if (s.mode !== 'idle' && s.mode !== 'anim') return;
  if (s.ohNoShown || s.ohNoReturn) return;
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
  s.line.push(DIRCODE[dir]);
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
  if (s.ohNoReturn) {
    ohno.complete();
    return;
  }
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
  saveGame(s);
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
  s.line.pop();
  s.renderBroken = new Set(s.gs.broken);
  s.renderFed = new Set(s.gs.fed);
  s.renderStars = new Set(s.gs.stars);
  s.ohNoShown = false;
  s.hintDir = null;
  s.heartUnlockT0 = null;
  audio.tick();
  hud();
  hints.afterStateChange();
  saveGame(s);
}

function currentDef(): Promise<LevelDef> {
  return s.play.kind === 'daily' ? assist.getDaily(s.play.date) : assist.getLevel(s.li);
}

function retry(): void {
  if (s.mode === 'anim' || s.mode === 'loading' || s.mode === 'intro' || s.mode === 'menu') return;
  if (s.winTimer !== null) {
    clearTimeout(s.winTimer);
    s.winTimer = null;
    endings.hideFlood();
  }
  audio.tick();
  fadeSwap(reduced, async () => applyLevel(await currentDef()));
}

/** Start (or restart) today's daily puzzle. */
function startDaily(): void {
  if (s.mode === 'loading') return;
  const date = localToday();
  s.play = { kind: 'daily', date };
  s.mode = 'loading';
  /* usually instant (prefetched at boot); cover the cold case cutely */
  const slow = window.setTimeout(
    () => toast("Baking today's puzzle…", { ms: 30000 }), 600);
  fadeSwap(reduced, async () => {
    const def = await assist.getDaily(date);
    clearTimeout(slow);
    applyLevel(def);
  });
}

/* --------------------------- endings / render ---------------------------- */
const dailyWin = createDailyWin();
const endings = createEndings({
  s, audio, main, canvas, reduced,
  caption: setCap,
  reload: () => fadeSwap(reduced, async () => applyLevel(await currentDef())),
  /* daily solved -> back to the campaign where the player left off */
  next: () => loadLevel(s.play.kind === 'daily' ? s.li : s.li + 1, true),
  dailyWin: (onContinue) => dailyWin.show(s, onContinue)
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
/* reflect the persisted mute state on boot */
document.getElementById('mute')?.classList.toggle('off', audio.isMuted());

bindInput(main, {
  doMove,
  undo,
  retry,
  hint: () => {
    /* tapping the bulb under an intro card means "let me play with hints" */
    if (s.mode === 'intro') intro.dismiss();
    if (s.mode === 'idle' || s.mode === 'anim') hints.toggleHintMode();
  },
  advance: () => {
    if (dailyWin.isOpen()) return; // the modal's own buttons decide
    endings.advance();
  },
  toggleMute,
  inWin: () => s.mode === 'win',
  unlockAudio: () => audio.unlock()
});
window.addEventListener('resize', () => layout());

/* friend first-meet cards: any tap or key dismisses */
const intro = createIntro(s, () => hints.afterStateChange());
document.getElementById('intro')?.addEventListener('pointerdown', () => intro.dismiss());
document.addEventListener('keydown', () => {
  if (s.mode === 'intro') intro.dismiss();
});

/* start screen + level picker */
const levelsPick = createLevelsPick({
  s,
  onPick: (li) => {
    startMenu.close();
    loadLevel(li);
  },
  unlockAudio: () => audio.unlock()
});
const startMenu = createStart({
  s,
  onPlay: () => {
    /* reveal the level the player left under the menu, then greet any
       not-yet-met friends or elements it holds */
    intro.maybeShow(s);
  },
  onDaily: () => startDaily(),
  onLevels: () => levelsPick.open(),
  unlockAudio: () => audio.unlock()
});

/* --------------------------------- boot ---------------------------------- */
installTestApi({
  s,
  doMove,
  loadLevel: (n) => loadLevel(n),
  startDaily,
  undo,
  retry,
  toggleHintMode: () => hints.toggleHintMode(),
  dismissIntro: () => intro.dismiss(),
  closeMenu: () => startMenu.close(),
  solution: () => hints.solution()
});

const saved = loadGame();
s.results = saved.results;
s.daily = saved.daily;
/* the menu owns the screen on boot — open it first so the level we restore
   underneath it does not fire its intro cards behind the menu */
startMenu.open();
if (saved.play.kind === 'daily' && saved.def && saved.play.date === localToday()) {
  /* resume today's daily exactly where it was left */
  s.li = saved.li;
  s.play = saved.play;
  applyLevel(saved.def);
  if (saved.line) {
    const rp = replayLine(s.level, saved.line);
    if (rp) {
      restoreReplay(s, rp);
      hud();
      hints.afterStateChange();
    }
  }
} else if (saved.play.kind === 'campaign' && saved.li < CURATED.length) {
  /* restore exactly where the player was, replaying the saved line */
  const cur = CURATED[saved.li] as LevelDef;
  s.li = saved.li;
  applyLevel(cur);
  if (saved.line && sameDef(saved.def, cur)) {
    const rp = replayLine(s.level, saved.line);
    if (rp) {
      restoreReplay(s, rp);
      hud();
      hints.afterStateChange();
      saveGame(s);
    } else {
      console.warn('[squishy] saved line no longer replays — starting level fresh');
    }
  }
} else {
  loadLevel(saved.li);
}
/* bake today's daily in its own worker while the player plays */
window.setTimeout(() => void assist.getDaily(localToday()), 4000);
requestAnimationFrame(render);
