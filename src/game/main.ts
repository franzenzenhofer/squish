/* Game orchestrator — boot, layout, level flow, move loop. Input, hints,
   endings and the oh-no sequence live in their own modules; this file only
   wires them together around the shared session. */
import { DIRCODE, cloneState, isWin, key, makeLevel } from '../engine/core';
import { move } from '../engine/move';
import type { Dir, LevelDef } from '../engine/types';
import { createAssist } from './assist';
import { createAudio } from './audio';
import { createEndings } from './endings';
import { buildSprites, cx, cy, handleFx, heartBurst, onEnd } from './fx';
import { drainFlood, fadeSwap } from './transition';
import { createHints } from './hints';
import { bindInput } from './input';
import { createIntro } from './intro';
import { bootPlan, hintHidden } from './flow';
import { localToday } from '../gen/daily';
import { createOhNo } from './ohno';
import { createLevelsPick } from './levelsPick';
import { loadGame, saveGame, dailyToken } from './persist';
import { DEBUG_LEVELS } from './debugLevels';
import { isDebug } from './debugMode';
import { getSettings, updateSettings, type Settings } from './settings';
import { createSettingsView } from './settingsView';
import { createStart } from './start';
import { mountWordmark } from './logo';
import { hideToast, toast } from './toast';
import { drawFrame, type RenderHooks } from './render';
import { CURATED, blankSession, type Session } from './session';
import { installTestApi } from './testapi';
import { createTracker } from '../lib/track';
import type { PlayKind, Platform } from '../lib/trackSchema';
import { solve } from '../engine/solve';
import { createBuilder, type SolveInfo } from '../builder/view';
import { installBuilderTestApi } from '../builder/testApi';
import { importShareCode, buildShareUrl } from '../share/shareUrl';
import { listCreations, getCreation, saveShared, getShared } from '../builder/library';

const audio = createAudio();
const assist = createAssist();
const s: Session = blankSession();

/* Anonymous play counters (see the Privacy & data card in settings): a
   whitelisted event name + small numbers, fire-and-forget via sendBeacon.
   No cookies, no IDs, events stand alone. Debug plays are not counted.
   ONE game core, two build targets: the hosted site posts same-origin to its
   own worker; the offline iOS (app://) build has no server, so it posts to the
   live worker - but only while genuinely online - and tags events 'ios' so the
   one shared dataset can split web from app. VITE_PLATFORM is set at build
   time (vite.config.ts); it is 'web' everywhere except the iOS build. */
const PLATFORM: Platform = import.meta.env.VITE_PLATFORM === 'ios' ? 'ios' : 'web';
const TRACK_URL = PLATFORM === 'ios' ? 'https://squishy.franzai.com/t' : '/t';
const { track } = createTracker({
  enabled: !isDebug(),
  platform: PLATFORM,
  /* daily-rotating anonymous token (issue #6) — generated only when an event is
     actually built, i.e. only when analytics is enabled and a beacon is sent */
  token: () => dailyToken(),
  /* the opt-out is read per event (live), so toggling it in Settings takes
     effect immediately; the iOS build additionally stays silent when offline */
  send: (body) => {
    if (!getSettings().analytics) return false;
    if (PLATFORM === 'ios' && !navigator.onLine) return false;
    return navigator.sendBeacon(TRACK_URL, body);
  }
});
const playKind = (): PlayKind =>
  s.play.kind === 'daily' ? 'd' : s.play.kind === 'debug' ? 'g' : 'c';
/* one quit beacon per level attempt: backgrounding mid-level counts once */
let quitSent = false;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden' || quitSent) return;
  if ((s.mode === 'idle' || s.mode === 'anim' || s.mode === 'ohno') && s.moves > 0) {
    quitSent = true;
    track('quit', { k: playKind(), li: s.li, mv: s.moves });
  }
});

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const main = document.getElementById('main') as HTMLElement;
const elLvl = document.getElementById('lvl') as HTMLElement;
const elMoves = document.getElementById('moves') as HTMLElement;
const elCap = document.getElementById('cap') as HTMLElement;
const elCapText = document.getElementById('capText') as HTMLElement;
const elHintBtn = document.getElementById('hint') as HTMLButtonElement;
const elBackEditor = document.getElementById('backToEditor') as HTMLButtonElement;
const elFooter = document.querySelector('footer') as HTMLElement;
/* The game ALWAYS animates (Franz, 2026-06-12): honoring prefers-reduced-motion
   froze the win replay, the Next countdown and the bloom on devices with iOS
   Reduce Motion / Low Power, which reads as broken in a game built on cuteness.
   Animations here are gentle and functional, so the OS flag is ignored. */
const reduced = false;

/* the current level's goal line, deferred behind first-meet overlays so the
   bubble and an overlay are never on screen together (the hard gate). The bubble
   also waits ENTRANCE_SETTLE_MS so it only fades in once the level has fully
   bloomed in — never over the entrance animation. */
const ENTRANCE_SETTLE_MS = 700;
let goalCap = '';
let goalCapTimer: number | null = null;

/* mount the one-and-only logo (SSOT) into the header wordmark — tapping it
   returns to the start screen (see start.ts brand binding) */
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
  if (elCap.classList.contains('show')) positionBubble();
}

/* Sit Squishy's speech bubble so its downward pointer lands ~3px above the
   board's top edge, instead of floating up under the header (which it did on
   iOS, where the centred board leaves a tall gap below the header). */
function positionBubble(): void {
  const boardTop = canvas.getBoundingClientRect().top;
  const POINTER = 13; // the ::before tail that hangs below the bubble
  const GAP = 3;      // Franz: just a few pixels above the playing field
  const top = boardTop - elCap.offsetHeight - POINTER - GAP;
  elCap.style.top = Math.max(8, Math.round(top)) + 'px';
}

/* ----------------------------- level flow ------------------------------- */
function setCap(txt: string, bad = false): void {
  if (s.capTimer !== null) {
    clearTimeout(s.capTimer);
    s.capTimer = null;
  }
  elCap.classList.toggle('bad', bad);
  /* caption text is app-authored (level data / fixed strings); a <b> keyword
     is allowed so Squishy can emphasise a word in the bubble. Text lands in
     #capText so the always-present X dismiss button survives the update */
  elCapText.innerHTML = txt;
  if (txt) {
    elCap.classList.add('show');
    positionBubble();
    audio.talk();
    s.capTimer = window.setTimeout(() => elCap.classList.remove('show'), 3600);
  } else {
    elCap.classList.remove('show');
  }
}

/** The bubble's tiny X: clear Squishy's current saying right away. */
function dismissCap(): void {
  if (s.capTimer !== null) {
    clearTimeout(s.capTimer);
    s.capTimer = null;
  }
  elCap.classList.remove('show');
}
document.getElementById('capX')?.addEventListener('click', dismissCap);

/* each bake gets a fresh oracle-cache key — two bakes are different levels */
let bakeSeq = 0;

function oracleKey(): string {
  if (s.play.kind === 'daily') return 'daily:' + s.play.date;
  if (s.play.kind === 'debug') {
    return s.play.di < 0 ? 'debug:bake:' + bakeSeq : 'debug:' + s.play.di;
  }
  return 'lvl:' + s.li;
}

function hud(): void {
  const n = s.li + 1;
  /* one continuous ladder: plain numbers forever */
  elLvl.textContent =
    s.play.kind === 'daily' ? 'Daily'
    : s.play.kind === 'debug' ? (s.play.di < 0 ? 'Bake' : 'T' + (s.play.di + 1))
    : String(n).padStart(2, '0');
  elMoves.innerHTML =
    '<b class="' + (s.moves > s.def.par ? 'over' : '') + '">' + s.moves +
    '</b><span class="dim">/' + s.def.par + '</span>';
  /* the hint bulb hides when the player turned it off OR whenever a daily is in
     play — the daily is solved without help. One place, every level + setting. */
  elFooter?.classList.toggle('nohint', hintHidden(getSettings().hintButton, s.play));
  /* teach the tools on the first few levels (where Hint matters most), then go
     icon-only — unless labels are off. Dailies have no Hint, so no Hint label. */
  if (elFooter) {
    elFooter.classList.toggle('labels',
      getSettings().buttonLabels &&
      s.play.kind === 'campaign' && s.li < 3);
  }
  /* debug plays carry the JSON export pill in the header */
  document.getElementById('dbgExport')?.classList.toggle(
    'show', isDebug() && s.play.kind === 'debug');
}

/** Push the current settings into the live chrome (footer classes, labels). */
function applySettings(patch?: Partial<Omit<Settings, 'v'>>): void {
  if (patch) updateSettings(patch);
  /* a hidden bulb must not leave a live hint arrow behind (hud() owns the
     nohint class — it also accounts for daily) */
  if (hintHidden(getSettings().hintButton, s.play) && s.hintMode) hints.toggleHintMode();
  hud();
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
  /* hint mode is per-level: each level starts in normal mode, un-peeked */
  s.hintMode = false;
  s.hintUsed = false;
  elHintBtn.classList.remove('on');
  s.lastMovers = null;
  s.ohNoShown = false;
  s.ohNoFace = false;
  s.ohNoReturn = false;
  s.heartUnlockT0 = null;
  hideToast();
  /* the "Back to editor" button belongs ONLY to an editor test-play */
  elBackEditor.classList.toggle('show', builderReturnDef !== null);
  document.getElementById('win')?.classList.remove('show');
  /* remember the level goal but do not speak it yet — the gate below decides
     whether an overlay greets first; clear any stale bubble from last level */
  goalCap = def.cap ?? '';
  if (goalCapTimer !== null) {
    clearTimeout(goalCapTimer);
    goalCapTimer = null;
  }
  setCap('');
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
  quitSent = false;
  track('start', { k: playKind(), li: s.li });
  /* first-meet cards greet new friends/elements only once the player is
     actually in the level — never behind the start menu, where the timed
     auto-dismiss would burn them unseen. The menu fires them on Play.
     The hard gate: an overlay and Squishy's goal bubble are never up at the
     same time. If overlays greet, the goal bubble waits for onAllDismissed. */
  if (startMenu.isOpen()) s.mode = 'menu';
  else if (!intro.maybeShow(s)) showGoalCap();
}

/** Speak the level goal once, but only when no overlay owns the screen, and only
    after the level has fully bloomed in (never over the entrance animation). The
    goal is consumed so a later tap-to-explain dismissal does not re-speak it. */
function showGoalCap(): void {
  if (s.mode === 'intro' || s.mode === 'menu') return;
  if (!goalCap) return;
  const txt = goalCap;
  goalCap = '';
  if (goalCapTimer !== null) clearTimeout(goalCapTimer);
  if (reduced) {
    setCap(txt);
    return;
  }
  goalCapTimer = window.setTimeout(() => {
    goalCapTimer = null;
    /* only speak if the player is still settling into the fresh level */
    if (s.mode === 'idle' && s.moves === 0) setCap(txt);
  }, ENTRANCE_SETTLE_MS);
}

function loadLevel(li: number, fromWin = false): void {
  s.li = li;
  s.play = { kind: 'campaign' };
  customShareUrl = null; // a campaign level is not a custom share
  builderReturnDef = null;
  customSeq = null;
  s.mode = 'loading';
  const defP = assist.getLevel(li);
  /* deep endless levels bake in the worker — cover a cold bake cutely (the
     usual case is instant: prefetched during the previous level, then cached) */
  if (li >= CURATED.length) {
    const slow = window.setTimeout(
      () => toast('Baking level ' + (li + 1) + '…', { ms: 120000 }), 600);
    void defP.then(() => {
      clearTimeout(slow);
      hideToast();
    });
  }
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
  onUnwinnable: () => {
    track('ohno', { k: playKind(), li: s.li, mv: s.moves });
    ohno.trigger();
  },
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
    /* nothing can move that way — say so visibly, not just a faint tick, so a
       refused swipe never reads as the game eating input */
    audio.tick();
    const now = performance.now();
    const axis = dir === 'left' || dir === 'right' ? 'x' : 'y';
    for (const dd of s.gs.dots) {
      s.pulses.push({ type: 'squash', key: key(dd.x, dd.y), axis, t0: now, dur: 240, amp: 0.18 });
    }
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
  if (s.play.kind === 'daily') return assist.getDaily(s.play.date);
  /* debug/baked: the def in play IS the level — reapply it as-is */
  if (s.play.kind === 'debug') return Promise.resolve(s.def);
  return assist.getLevel(s.li);
}

/** Play a hand-authored debug test level (picker, ?debug=doit only). */
function loadTestLevel(di: number): void {
  const t = DEBUG_LEVELS[di];
  if (!t) return;
  s.play = { kind: 'debug', di };
  s.mode = 'loading';
  fadeSwap(reduced, async () => applyLevel(t.def));
}

/** Bake a one-off level at the requested hardness and play it.
    Resolves true on success so the picker knows to close. */
async function bakeAndPlay(hardness: number): Promise<boolean> {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  toast('Baking hardness ' + hardness + '…', { ms: 30000 });
  const def = await assist.bake(hardness, seed);
  hideToast();
  if (!def) {
    toast('That bake fell flat - try again!', { ms: 2200 });
    return false;
  }
  bakeSeq++;
  s.play = { kind: 'debug', di: -1 };
  s.mode = 'loading';
  fadeSwap(reduced, async () => applyLevel(def));
  return true;
}

/** Download + copy the current level def — paste it to Claude to keep it. */
function exportCurrentLevel(): void {
  const json = JSON.stringify(s.def);
  void navigator.clipboard?.writeText(json).catch(() => undefined);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = 'squishy-level-' + Date.now() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Level JSON copied + downloaded', { ms: 2000 });
}
document.getElementById('dbgExport')?.addEventListener('click', exportCurrentLevel);

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
const endings = createEndings({
  s, audio, main, canvas, reduced, track,
  caption: setCap,
  reload: () => fadeSwap(reduced, async () => applyLevel(await currentDef())),
  isBuilderReturn: () => builderReturnDef !== null,
  /* an editor test-play returns to the editor (via the shared history-back exit,
     so the nav stack stays clean); daily -> campaign; other debug -> the picker;
     campaign -> the next level */
  next: () => {
    if (builderReturnDef) { history.back(); return; }
    if (customSeq) {
      endings.hideFlood();
      customSeq.i++;
      if (customSeq.i < customSeq.ids.length) { playCustomAt(); return; }
      /* the saved levels are done -> go STRAIGHT on with the normal campaign
         progress (no detour through the picker) */
      customSeq = null;
      customShareUrl = null;
      s.play = { kind: 'campaign' };
      loadLevel(s.li, true);
      return;
    }
    if (s.play.kind === 'debug') {
      endings.hideFlood();
      s.play = { kind: 'campaign' };
      loadLevel(s.li);
      levelsPick.open();
      return;
    }
    loadLevel(s.play.kind === 'daily' ? s.li : s.li + 1, true);
  },
  shareUrlOverride: () => customShareUrl
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
/* the sound button only stays tappable when sound can really play: after a
   gesture tried to unlock, a context that is not RUNNING means WebAudio is
   blocked or unavailable on this device — disable the button honestly */
audio.onStateChange(() => {
  const b = document.getElementById('mute') as HTMLButtonElement | null;
  if (b) b.disabled = !audio.isLive();
});

/* ------------------------- tap-to-explain / pet -------------------------- */
function moverKindAt(x: number, y: number): string | null {
  const g = s.gs;
  const hit = (arr: { x: number; y: number }[]): boolean => arr.some((p) => p.x === x && p.y === y);
  if (hit(g.penguins)) return 'penguin';
  if (hit(g.bunnies)) return 'bunny';
  if (hit(g.frogs)) return 'frog';
  if (hit(g.bears)) return 'bear';
  if (hit(g.ghosts)) return 'ghost';
  if (hit(g.pandas)) return 'panda';
  if (hit(g.cats)) return 'cat';
  if (hit(g.chicks)) return 'chick';
  if (hit(g.pigs)) return 'pig';
  if (hit(g.boxes)) return 'box';
  if (hit(g.balloons)) return 'balloon';
  if (hit(g.snails)) return 'snail';
  return null;
}

function fieldKindAt(k: string): string | null {
  const L = s.level;
  if (L.noms.has(k) && !s.renderFed.has(k)) return 'nom';
  if (L.ice.has(k) && !s.renderBroken.has(k)) return 'ice';
  if (L.sticky.has(k)) return 'honey';
  if (L.split.has(k)) return 'split';
  if (L.portal.has(k)) return 'portal';
  if (L.turn.has(k)) return 'turn';
  if (L.spring.has(k)) return 'spring';
  if (L.breeze.has(k)) return 'breeze';
  if (L.jelly.has(k)) return 'jelly';
  if (L.oneway.has(k)) return 'oneway';
  if (L.walls.has(k)) return 'wall';
  return null;
}

/** Pet your own squishy, or explain whatever sits on cell (gx, gy). */
function explainCell(gx: number, gy: number): void {
  if (s.mode !== 'idle') return;
  if (gx < 0 || gy < 0 || gx >= s.level.w || gy >= s.level.h) return;
  const k = key(gx, gy);
  if (s.gs.dots.some((p) => p.x === gx && p.y === gy)) {
    petSquishy(gx, gy);
    return;
  }
  const mover = moverKindAt(gx, gy);
  if (mover) return intro.showKind(mover);
  if (s.renderStars.has(k)) return intro.showKind('star');
  if (gx === s.level.tx && gy === s.level.ty) return intro.showKind('heart');
  const field = fieldKindAt(k);
  if (field) intro.showKind(field);
}

/** Tap on the board: convert the screen point to a cell, then explain/pet. */
function boardTap(clientX: number, clientY: number): void {
  const r = canvas.getBoundingClientRect();
  if (r.width === 0) return;
  const gx = Math.floor(((clientX - r.left) * (s.cssSize / r.width) - s.ox) / s.cell);
  const gy = Math.floor(((clientY - r.top) * (s.cssSize / r.height) - s.oy) / s.cell);
  explainCell(gx, gy);
}

/** Petting your squishy: a giddy joy-face double-bounce + a heart shower. */
function petSquishy(x: number, y: number): void {
  const now = performance.now();
  const k = key(x, y);
  s.petKey = k;
  s.petT0 = now;
  s.pulses.push({ type: 'pop', key: k, t0: now, dur: 300, amp: 0.55 });
  s.pulses.push({ type: 'pop', key: k, t0: now + 280, dur: 340, amp: 0.34 });
  s.pulses.push({ type: 'squash', key: k, axis: 'y', t0: now + 140, dur: 220, amp: 0.26 });
  heartBurst(s, cx(s, x), cy(s, y), 16);
  audio.happy();
  audio.buzz(12);
}

bindInput(main, {
  doMove,
  undo,
  retry,
  hint: () => {
    /* the bulb can be tucked away in settings — then it stays unreachable */
    if (!getSettings().hintButton) return;
    /* tapping the bulb under an intro card means "let me play with hints" */
    if (s.mode === 'intro') intro.dismiss();
    if (s.mode === 'idle' || s.mode === 'anim') {
      hints.toggleHintMode();
      if (s.hintMode) track('hint', { k: playKind(), li: s.li });
    }
  },
  advance: () => endings.advance(),
  toggleMute,
  /* the win card has its own Next button — taps no longer auto-advance */
  inWin: () => false,
  onTap: boardTap,
  unlockAudio: () => audio.unlock()
});
window.addEventListener('resize', () => layout());

/* friend first-meet cards: any tap or key dismisses. When the last overlay
   closes, re-arm hints. The overlay IS the explanation for that element, so no
   goal bubble follows it — an explained element is never re-spoken as a bubble. */
const intro = createIntro(s, () => {
  hints.afterStateChange();
});
document.getElementById('intro')?.addEventListener('pointerdown', () => intro.dismiss());
document.addEventListener('keydown', () => {
  if (s.mode === 'intro') intro.dismiss();
});

/* start screen + level picker + settings */
const settingsView = createSettingsView({
  onChange: () => applySettings(),
  unlockAudio: () => audio.unlock()
});
const levelsPick = createLevelsPick({
  s,
  onPick: (li) => {
    startMenu.close();
    loadLevel(li);
  },
  onPickTest: (di) => {
    startMenu.close();
    loadTestLevel(di);
  },
  onBake: async (hardness) => {
    startMenu.close();
    return bakeAndPlay(hardness);
  },
  onPlayCustom: (id) => { startMenu.close(); playCustomSequence(id); },
  onEditCustom: (id) => void builder.editCreation(id),
  onPlayShared: (id) => { startMenu.close(); playShared(id); },
  onEditShared: (id) => { const cr = getShared(localStorage, id); if (cr) void builder.open(cr.def); },
  unlockAudio: () => audio.unlock()
});
/* the level editor — plays a built level through the SAME applyLevel path, and
   judges solvability with the SAME worker solver (par = the optimal solution
   length). It returns to the start menu on exit. */
/* a custom/shared level in play: its #level- URL (for the win-card Share) and,
   for an editor test-play, the def to return to when the player is done. */
let customShareUrl: string | null = null;
let builderReturnDef: LevelDef | null = null;
function customUrlOf(def: LevelDef): string | null {
  try { return buildShareUrl(def); } catch { return null; }
}
function playBuilderLevel(def: LevelDef): void {
  s.play = { kind: 'debug', di: -1 };
  customShareUrl = customUrlOf(def);
  builderReturnDef = def; // a Play test returns to the editor when finished
  customSeq = null;
  /* a play-view history entry so the browser Back button (and the on-screen
     "Back to editor" button, and the win "Editor" button) all step back to the
     editor through the SAME exit: history.back() -> popstate -> returnToEditor */
  history.pushState({ sqPlay: true }, '');
  fadeSwap(reduced, async () => applyLevel(def));
}

/** The one way back from a built-level test-play to the editor (level intact).
    Reached only via history.back() so the nav stack lands on the editor entry. */
function returnToEditor(): void {
  if (!builderReturnDef) return;
  const def = builderReturnDef;
  builderReturnDef = null;
  customShareUrl = null;
  endings.hideFlood();
  elBackEditor.classList.remove('show');
  document.getElementById('win')?.classList.remove('show');
  void builder.open(def);
}

/* Playing your saved levels from the picker walks the "Your Levels" list: each
   win advances to the next saved level; after the last, you resume the campaign
   where you left off. */
let customSeq: { ids: string[]; i: number } | null = null;
function playCustomSequence(id: string): void {
  const ids = listCreations(localStorage).map((c) => c.id);
  const i = ids.indexOf(id);
  if (i < 0) return;
  customSeq = { ids, i };
  playCustomAt();
}
function playCustomAt(): void {
  const cr = customSeq && getCreation(localStorage, customSeq.ids[customSeq.i] ?? '');
  if (!cr) { customSeq = null; loadLevel(s.li); return; }
  s.play = { kind: 'debug', di: -1 };
  customShareUrl = customUrlOf(cr.def);
  builderReturnDef = null;
  fadeSwap(reduced, async () => applyLevel(cr.def));
}
/** Play one level from "Shared with you" (a one-off, not the saved-level walk). */
function playShared(id: string): void {
  const cr = getShared(localStorage, id);
  if (!cr) return;
  customSeq = null;
  s.play = { kind: 'debug', di: -1 };
  customShareUrl = customUrlOf(cr.def);
  builderReturnDef = null;
  fadeSwap(reduced, async () => applyLevel(cr.def));
}
const builderSolve = async (def: LevelDef): Promise<SolveInfo> => {
  const r = await assist.deepSolve(def, cloneState(makeLevel(def).initState));
  if (r.status === 'solved') return { status: 'solvable', par: r.solution.length };
  return { status: r.status === 'unsolvable' ? 'unsolvable' : 'unknown', par: 0 };
};
const builder = createBuilder({
  s,
  playDef: playBuilderLevel,
  solveDef: builderSolve,
  onExit: () => startMenu.open(),
  closeMenu: () => startMenu.close()
});
/* Registered AFTER createBuilder so the builder's own popstate handler runs
   FIRST on a Back: while a built level is playing the editor is hidden, so that
   handler no-ops, and then THIS one reopens the editor. The on-screen button
   and the win "Editor" button reuse the same exit (history.back()). */
window.addEventListener('popstate', () => {
  if (builderReturnDef && !builder.isOpen()) returnToEditor();
});
elBackEditor.addEventListener('click', () => history.back());
const startMenu = createStart({
  s,
  onPlay: () => {
    /* Continue/Play ALWAYS (re)starts the campaign level fresh — it never
       reveals a leftover daily (s.play may still be daily when the menu was
       opened from one) and never resumes a half-played board. loadLevel sets
       play=campaign, rebuilds from the initial state, and fires the intro/goal
       gate itself. The daily is reachable only via its button or #daily. */
    loadLevel(s.li);
  },
  onDaily: () => startDaily(),
  onLevels: () => levelsPick.open(),
  onCreate: () => void builder.open(),
  onSettings: () => settingsView.open(),
  unlockAudio: () => audio.unlock()
});

/* --------------------------------- boot ---------------------------------- */
installTestApi({
  s,
  doMove,
  loadLevel: (n) => loadLevel(n),
  loadTestLevel,
  startDaily,
  undo,
  retry,
  toggleHintMode: () => hints.toggleHintMode(),
  dismissIntro: () => intro.dismiss(),
  closeMenu: () => startMenu.close(),
  tapCell: (x, y) => explainCell(x, y),
  solution: () => hints.solution(),
  applySettings
});
installBuilderTestApi(builder);

/* a shared #level-<code> link: decode (CRC-checked), prove it solves, stamp the
   optimal par, then play it. An untrusted/broken link never crashes — it falls
   back to the menu with a friendly toast. */
/** Remember a level opened from a share link in "Shared with you" — UNLESS it is
    one of your OWN creations (sharing a link with yourself must never repopulate
    the list) and idempotent on the share code (the same link is never added twice). */
function rememberSharedLevel(def: LevelDef): void {
  try {
    const code = buildShareUrl(def); // canonical content key (glyphs + crc)
    const mine = listCreations(localStorage).some((c) => {
      const cr = getCreation(localStorage, c.id);
      return cr ? customUrlOf(cr.def) === code : false;
    });
    if (mine) return;
    saveShared(localStorage, def, code, 'Shared level');
  } catch { /* never block play on a bookkeeping hiccup */ }
}

function startShared(code: string): void {
  try {
    const def = importShareCode(code, (d) => solve(makeLevel(d)));
    rememberSharedLevel(def); // keep it in "Shared with you" (deduped)
    s.play = { kind: 'debug', di: -1 };
    customShareUrl = customUrlOf(def);
    builderReturnDef = null;
    history.replaceState(null, '', location.pathname + location.search);
    fadeSwap(reduced, async () => applyLevel(def));
  } catch (e) {
    console.error('[shared] import failed:', e);
    toast('That puzzle link looks broken');
    startMenu.open();
    loadLevel(s.li);
  }
}

const saved = loadGame();
s.results = saved.results;
s.hinted = saved.hinted;
s.daily = saved.daily;
applySettings();
/* a #daily deep-link (the daily share link) drops straight into today's daily;
   every other entry resumes the saved CAMPAIGN level — the daily is never a
   resume target, so "Continue" always returns to the real level, fresh. */
const plan = bootPlan(saved.li, location.hash);
/* restore the resume level index BEFORE the menu paints, so the Play/Continue
   button reads the correct level on its very first frame (no "Level 1" flash) */
s.li = plan.li;
if (plan.daily) {
  /* strip the hash so a later reload resumes campaign, not the daily again */
  history.replaceState(null, '', location.pathname + location.search);
  startDaily();
} else if (plan.builder) {
  history.replaceState(null, '', location.pathname + location.search);
  void builder.open();
} else if (plan.shared) {
  startShared(plan.shared);
} else {
  /* the menu owns the screen on boot — open it first so the campaign level we
     load underneath does not fire its intro cards behind the menu. Boot and the
     Continue button use the SAME loader (loadLevel = the single source of truth
     for "campaign level N, fresh"): there is no second code path to drift. */
  startMenu.open();
  loadLevel(plan.li);
}
/* bake today's daily in its own worker while the player plays */
window.setTimeout(() => void assist.getDaily(localToday()), 4000);
track('boot');
requestAnimationFrame(render);
/* readiness signal: the iOS wrapper (ios-app-maker GameWebView) holds its splash
   until this is true, so it only reveals the webview once the game can be played */
(window as unknown as { __ready?: boolean }).__ready = true;
