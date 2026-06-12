/* Endings — the win celebration (heart burst + pink flood flourish, then the
   unified win card with Share + Next) and the lose shake. Owns #flood / #win.
   One card serves campaign and daily; campaign no longer auto-advances. */
import type { Audio } from './audio';
import { cx, cy, heartBurst } from './fx';
import { saveGame } from './persist';
import { CARD_H, CARD_W, renderBoardCard, shareCard } from './share';
import type { Session } from './session';

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
  const elWinSub = document.getElementById('winSub') as HTMLElement;
  const elWinTag = document.getElementById('winTag') as HTMLElement;
  const elShot = document.getElementById('winShot') as HTMLCanvasElement;

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
    elWin.classList.remove('show');
  };

  const advance = (): void => {
    if (s.winTimer !== null) {
      clearTimeout(s.winTimer);
      s.winTimer = null;
    }
    /* keep the flood up — the next level drains it into its own heart */
    elWin.classList.remove('show');
    d.next();
  };

  const showCard = (label: string, hearts: number): void => {
    const mv = s.moves + (s.moves === 1 ? ' move' : ' moves');
    elWinSub.innerHTML = label + ' · solved in <b>' + mv + '</b>';
    elWinTag.innerHTML = 'Squishy-tastic! ✨' + ratingHearts(hearts);
    /* the shareable postcard, scaled into the card preview */
    const card = renderBoardCard(s.def, label);
    const w = 300;
    elShot.width = w;
    elShot.height = Math.round((CARD_H / CARD_W) * w);
    elShot.getContext('2d')?.drawImage(card, 0, 0, elShot.width, elShot.height);
    elWin.dataset.def = JSON.stringify(s.def);
    elWin.dataset.label = label;
    elWin.dataset.moves = String(s.moves);
    elWin.classList.add('show');
  };

  document.getElementById('winShare')?.addEventListener('click', () => {
    const ds = elWin.dataset;
    if (ds.def && ds.label) {
      void shareCard(JSON.parse(ds.def) as Session['def'], ds.label, Number(ds.moves));
    }
  });
  document.getElementById('winNext')?.addEventListener('click', () => {
    audio.unlock();
    advance();
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
    } else {
      const prev = s.results[s.li];
      if (prev === undefined || s.moves < prev) s.results[s.li] = s.moves;
    }
    saveGame(s);
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
