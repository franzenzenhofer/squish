/* Endings — the win celebration (heart burst, pink flood, message, auto
   advance) and the lose shake. Owns the #flood / #msg DOM. */
import type { Audio } from './audio';
import { cx, cy, heartBurst } from './fx';
import { saveGame } from './persist';
import type { Session } from './session';

const WINWORDS = ['sweet!', 'yay!', 'lovely!', 'cutie!', 'aww!', 'hooray!'];

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
}

function ratingHearts(n: number): string {
  let h = '';
  for (let i = 0; i < 3; i++) {
    h += '<svg class="rh ' + (i < n ? 'on' : '') +
      '" viewBox="0 0 32 30"><path d="M16 27 C4 18 3 10 8.5 7.5 C12.5 5.7 16 9 16 12 C16 9 19.5 5.7 23.5 7.5 C29 10 28 18 16 27 Z"/></svg>';
  }
  return '<div class="rate">' + h + '</div>';
}

export function createEndings(d: EndingsDeps): Endings {
  const { s, audio } = d;
  const elFlood = document.getElementById('flood') as HTMLElement;
  const elMsg = document.getElementById('msg') as HTMLElement;
  const elMsgBig = document.getElementById('msgbig') as HTMLElement;
  const elMsgSub = document.getElementById('msgsub') as HTMLElement;

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
    elMsg.classList.remove('show');
  };

  const advance = (): void => {
    if (s.winTimer !== null) {
      clearTimeout(s.winTimer);
      s.winTimer = null;
    }
    hideFlood();
    d.next();
  };

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
    setTimeout(() => {
      floodAt(cx(s, s.level.tx), cy(s, s.level.ty));
      elMsgBig.textContent = WINWORDS[Math.floor(Math.random() * WINWORDS.length)] ?? 'sweet!';
      elMsgSub.innerHTML = ratingHearts(hearts);
      setTimeout(() => elMsg.classList.add('show'), d.reduced ? 0 : 220);
      s.winTimer = window.setTimeout(advance, 1250);
    }, d.reduced ? 0 : 440);
  };

  const loseSeq = (): void => {
    s.mode = 'lose';
    audio.buzz([15, 40, 15]);
    d.caption('nom! a nomster got your squishy', true);
    if (!d.reduced) d.main.classList.add('shake');
    setTimeout(() => {
      d.main.classList.remove('shake');
      d.reload();
    }, 700);
  };

  return { winSeq, loseSeq, advance, hideFlood };
}
