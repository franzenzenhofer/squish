/* Endings — the win celebration (heart burst + pink flood flourish, then the
   unified win card with Share + Next) and the lose shake. Owns #flood / #win.
   One card serves campaign and daily; campaign no longer auto-advances. */
import type { Audio } from './audio';
import { cx, cy, heartBurst } from './fx';
import { saveAdvance, saveGame } from './persist';
import { shareCard } from './share';
import type { Session } from './session';
import { pickWinLine, pickWinTitle } from './winLines';
import { startWinReplay, type WinReplay } from './winReplay';

/** No-interaction auto-advance window on the Next button. */
const AUTO_ADVANCE_MS = 7000;

export interface EndingsDeps {
  s: Session;
  audio: Audio;
  main: HTMLElement;
  canvas: HTMLCanvasElement;
  reduced: boolean;
  caption: (txt: string, bad: boolean) => void;
  reload: () => void;
  next: () => void;
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

/** Campaign "Level 12" / daily "Daily 06-12" — the card caption + share label. */
function levelLabel(s: Session): string {
  return s.play.kind === 'daily' ? 'Daily ' + s.play.date : 'Level ' + (s.li + 1);
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

  /** Tear down the looping replay + the no-interaction auto-advance ring. */
  const stopReplay = (): void => {
    replay?.stop();
    replay = null;
  };
  const cancelAuto = (): void => {
    if (autoTimer !== null) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    elNext.classList.remove('counting');
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

  const showCard = (label: string, hearts: number): void => {
    elWinTitle.textContent = pickWinTitle();
    const mv = s.moves + (s.moves === 1 ? ' move' : ' moves');
    elWinSub.innerHTML = label + ' · solved in <b>' + mv + '</b>';
    elWinTag.innerHTML = pickWinLine(hearts) + ratingHearts(hearts);
    /* the in-app card REPLAYS the player's recorded solution, looping - always
       animated, painted by the one gameplay renderer */
    const line = s.line.join('');
    stopReplay();
    replay = startWinReplay(elShot, s.def, label, line);
    elWin.dataset.def = JSON.stringify(s.def);
    elWin.dataset.label = label;
    elWin.classList.add('show');
    /* 7s no-interaction auto-advance with a countdown ring on Next */
    cancelAuto();
    void elNext.offsetWidth; /* reflow so the ring animation restarts each win */
    elNext.classList.add('counting');
    autoTimer = window.setTimeout(() => {
      autoTimer = null;
      advance();
    }, AUTO_ADVANCE_MS);
  };

  document.getElementById('winShare')?.addEventListener('click', () => {
    /* any interaction with the card cancels the auto-advance countdown */
    cancelAuto();
    const ds = elWin.dataset;
    if (ds.def && ds.label) {
      void shareCard(JSON.parse(ds.def) as Session['def'], ds.label);
    }
  });
  elNext.addEventListener('click', () => {
    audio.unlock();
    advance();
  });
  /* tapping the card itself (not a button) also cancels the auto-advance */
  document.getElementById('winCard')?.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button') === null) cancelAuto();
  });

  const winSeq = (): void => {
    s.mode = 'win';
    s.winFace = true;
    audio.win();
    audio.buzz(30);
    s.pulses.push({ type: 'pop', key: s.level.target, t0: performance.now(), dur: 420, amp: 0.55 });
    heartBurst(s, cx(s, s.level.tx), cy(s, s.level.ty), 28);
    if (s.play.kind === 'daily') {
      const prev = s.daily[s.play.date];
      if (prev === undefined || s.moves < prev) s.daily[s.play.date] = s.moves;
      saveGame(s);
    } else {
      const prev = s.results[s.li];
      if (prev === undefined || s.moves < prev) s.results[s.li] = s.moves;
      /* advance the saved resume pointer now, so quitting during the win card
         still resumes on the next level */
      saveAdvance(s, s.li + 1);
    }
    const hearts = s.moves <= s.def.par ? 3 : s.moves <= s.def.par + 1 ? 2 : 1;
    const label = levelLabel(s);
    setTimeout(() => {
      floodAt(cx(s, s.level.tx), cy(s, s.level.ty));
      s.winTimer = window.setTimeout(() => {
        s.winTimer = null;
        showCard(label, hearts);
      }, d.reduced ? 0 : 320);
    }, d.reduced ? 0 : 440);
  };

  const loseSeq = (): void => {
    s.mode = 'lose';
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
