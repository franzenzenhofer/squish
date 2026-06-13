/* Endings — the win celebration (heart burst + pink flood flourish, then the
   unified win card with Share + Next) and the lose shake. Owns #flood / #win.
   One card serves campaign and daily; campaign no longer auto-advances. */
import type { Audio } from './audio';
import { cx, cy, heartBurst } from './fx';
import { saveAdvance, saveGame } from './persist';
import { getSettings } from './settings';
import { shareCard } from './share';
import type { Session } from './session';
import type { Tracker } from '../lib/track';
import type { PlayKind } from '../lib/trackSchema';
import { pickHintedLine, pickWinLine, pickWinTitle } from './winLines';
import { startWinReplay, type WinReplay } from './winReplay';

/** No-interaction auto-advance window on the Next button. 4s = the Material
    default for transient dismissible surfaces (toasts 2-4s, snackbars 4-10s):
    long enough to read the card, short enough to keep the flow - and holding
    the replay pauses it, so watching is never cut short. */
const AUTO_ADVANCE_MS = 4000;

export interface EndingsDeps {
  s: Session;
  audio: Audio;
  main: HTMLElement;
  canvas: HTMLCanvasElement;
  reduced: boolean;
  caption: (txt: string, bad: boolean) => void;
  reload: () => void;
  next: () => void;
  track: Tracker['track'];
}

/** Single-letter anonymous play kind for the counters. */
function trackKind(s: Session): PlayKind {
  return s.play.kind === 'daily' ? 'd' : s.play.kind === 'debug' ? 'g' : 'c';
}

export interface Endings {
  winSeq: () => void;
  loseSeq: () => void;
  advance: () => void;
  hideFlood: () => void;
  isOpen: () => boolean;
}

function ratingHearts(n: number): string {
  let h = '';
  for (let i = 0; i < 3; i++) {
    h += '<svg class="rh ' + (i < n ? 'on' : '') +
      '" viewBox="0 0 32 30"><path d="M16 27 C4 18 3 10 8.5 7.5 C12.5 5.7 16 9 16 12 C16 9 19.5 5.7 23.5 7.5 C29 10 28 18 16 27 Z"/></svg>';
  }
  return '<div class="rate">' + h + '</div>';
}

/** Campaign "Level 12" / daily "Daily 06-12" / debug "Test 3" — card + share label. */
function levelLabel(s: Session): string {
  if (s.play.kind === 'daily') return 'Daily ' + s.play.date;
  if (s.play.kind === 'debug') {
    return s.play.di < 0 ? 'Baked level' : 'Test ' + (s.play.di + 1);
  }
  return 'Level ' + (s.li + 1);
}

export function createEndings(d: EndingsDeps): Endings {
  const { s, audio } = d;
  const elFlood = document.getElementById('flood') as HTMLElement;
  const elWin = document.getElementById('win') as HTMLElement;
  const elWinTitle = document.getElementById('winTitle') as HTMLElement;
  const elWinSub = document.getElementById('winSub') as HTMLElement;
  const elWinTag = document.getElementById('winTag') as HTMLElement;
  const elShot = document.getElementById('winShot') as HTMLCanvasElement;
  const elNext = document.getElementById('winNext') as HTMLElement;

  let replay: WinReplay | null = null;
  let autoTimer: number | null = null;
  let autoRemain = 0;
  let autoT0 = 0;
  let holding = false;

  /** Tear down the looping replay + the no-interaction auto-advance ring. */
  const stopReplay = (): void => {
    replay?.stop();
    replay = null;
  };
  const startAuto = (ms: number): void => {
    autoT0 = performance.now();
    autoRemain = ms;
    autoTimer = window.setTimeout(() => {
      autoTimer = null;
      advance();
    }, ms);
  };
  const cancelAuto = (): void => {
    if (autoTimer !== null) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    holding = false;
    elNext.classList.remove('counting', 'paused');
  };

  /* Holding a finger on the replay pauses the countdown (ring freezes with
     it) so the solution can be watched in peace; release resumes. */
  const pauseAuto = (): void => {
    if (autoTimer === null) return;
    clearTimeout(autoTimer);
    autoTimer = null;
    autoRemain = Math.max(400, autoRemain - (performance.now() - autoT0));
    holding = true;
    elNext.classList.add('paused');
  };
  const resumeAuto = (): void => {
    if (!holding) return;
    holding = false;
    elNext.classList.remove('paused');
    if (elWin.classList.contains('show') && elNext.classList.contains('counting')) {
      startAuto(autoRemain);
    }
  };

  const floodAt = (px: number, py: number): void => {
    const r = d.canvas.getBoundingClientRect();
    const mr = d.main.getBoundingClientRect();
    const x = r.left - mr.left + px;
    const y = r.top - mr.top + py;
    elFlood.style.transition = 'none';
    elFlood.style.clipPath = 'circle(0px at ' + x + 'px ' + y + 'px)';
    void elFlood.offsetWidth;
    elFlood.style.transition = d.reduced ? 'none' : 'clip-path .36s cubic-bezier(.2,.7,.3,1)';
    elFlood.style.clipPath = 'circle(150% at ' + x + 'px ' + y + 'px)';
  };

  const hideFlood = (): void => {
    elFlood.style.transition = 'none';
    elFlood.style.clipPath = 'circle(0px at 50% 50%)';
    stopReplay();
    cancelAuto();
    elWin.classList.remove('show');
  };

  const advance = (): void => {
    if (s.winTimer !== null) {
      clearTimeout(s.winTimer);
      s.winTimer = null;
    }
    stopReplay();
    cancelAuto();
    /* keep the flood up — the next level drains it into its own heart */
    elWin.classList.remove('show');
    d.next();
  };

  const showCard = (label: string, hearts: number, hinted: boolean): void => {
    elWinTitle.textContent = pickWinTitle();
    const mv = s.moves + (s.moves === 1 ? ' move' : ' moves');
    elWinSub.innerHTML = label + ' · solved in <b>' + mv + '</b>';
    /* a hinted solve celebrates too, but the hearts stay empty */
    elWinTag.innerHTML = (hinted ? pickHintedLine() : pickWinLine(hearts)) + ratingHearts(hearts);
    /* the in-app card REPLAYS the player's recorded solution, looping - always
       animated, painted by the one gameplay renderer */
    const line = s.line.join('');
    stopReplay();
    replay = startWinReplay(elShot, s.def, label, line);
    elWin.dataset.def = JSON.stringify(s.def);
    elWin.dataset.label = label;
    elWin.dataset.line = line;
    elWin.classList.add('show');
    cancelAuto();
    /* 4s no-interaction auto-advance with a countdown ring on Next — only in
       the default 'auto' mode; 'wait' keeps the card up until a tap */
    if (getSettings().afterWin !== 'auto') return;
    void elNext.offsetWidth; /* reflow so the ring animation restarts each win */
    elNext.classList.add('counting');
    startAuto(AUTO_ADVANCE_MS);
  };

  document.getElementById('winShare')?.addEventListener('click', () => {
    /* any interaction with the card cancels the auto-advance countdown */
    cancelAuto();
    const ds = elWin.dataset;
    if (ds.def && ds.label) {
      d.track('share', { k: trackKind(s), li: s.li });
      void shareCard(JSON.parse(ds.def) as Session['def'], ds.label, ds.line ?? '');
    }
  });
  elNext.addEventListener('click', () => {
    audio.unlock();
    advance();
  });
  /* touch-and-hold ON THE REPLAY pauses the countdown for the hold */
  elShot.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    pauseAuto();
  });
  window.addEventListener('pointerup', resumeAuto);
  window.addEventListener('pointercancel', resumeAuto);
  /* tapping the card itself (not a button, not the replay) cancels it */
  document.getElementById('winCard')?.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('button') === null && t !== elShot) cancelAuto();
  });

  const winSeq = (): void => {
    s.mode = 'win';
    s.winFace = true;
    audio.win();
    audio.buzz(30);
    s.pulses.push({ type: 'pop', key: s.level.target, t0: performance.now(), dur: 420, amp: 0.55 });
    heartBurst(s, cx(s, s.level.tx), cy(s, s.level.ty), 28);
    const hinted = s.hintUsed;
    if (s.play.kind === 'daily') {
      /* a hinted daily never records a best — bests are earned hint-free */
      if (!hinted) {
        const prev = s.daily[s.play.date];
        if (prev === undefined || s.moves < prev) s.daily[s.play.date] = s.moves;
      }
      saveGame(s);
    } else if (s.play.kind === 'campaign') {
      if (hinted) {
        /* done with help: mark hinted only if no clean result exists — a clean
           best (and its hearts) is never degraded by a later hinted replay */
        if (s.results[s.li] === undefined) s.hinted[s.li] = true;
      } else {
        const prev = s.results[s.li];
        if (prev === undefined || s.moves < prev) s.results[s.li] = s.moves;
        delete s.hinted[s.li];
      }
      /* advance the saved resume pointer now, so quitting during the win card
         still resumes on the next level */
      saveAdvance(s, s.li + 1);
    }
    /* debug test plays write nothing */
    const hearts = hinted ? 0 : s.moves <= s.def.par ? 3 : s.moves <= s.def.par + 1 ? 2 : 1;
    d.track('win', {
      k: trackKind(s), li: s.li, mv: s.moves,
      par: s.def.par, hr: hearts, hd: hinted ? 1 : 0
    });
    const label = levelLabel(s);
    /* 'instant': celebrate (burst + flood), then zoom straight into the next
       campaign level — no card. Daily/debug always show the card (no ladder). */
    const instant = getSettings().afterWin === 'instant' && s.play.kind === 'campaign';
    setTimeout(() => {
      floodAt(cx(s, s.level.tx), cy(s, s.level.ty));
      s.winTimer = window.setTimeout(() => {
        s.winTimer = null;
        if (instant) advance();
        else showCard(label, hearts, hinted);
      }, d.reduced ? 0 : instant ? 460 : 320);
    }, d.reduced ? 0 : 440);
  };

  const loseSeq = (): void => {
    s.mode = 'lose';
    d.track('lose', { k: trackKind(s), li: s.li, mv: s.moves });
    audio.buzz([15, 40, 15]);
    d.caption('Oops - a nomster gobbled you!', true);
    if (!d.reduced) d.main.classList.add('shake');
    setTimeout(() => {
      d.main.classList.remove('shake');
      d.reload();
    }, 700);
  };

  return { winSeq, loseSeq, advance, hideFlood, isOpen: () => elWin.classList.contains('show') };
}
