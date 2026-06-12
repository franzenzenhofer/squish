/* Start screen — title, a shelf of idling friends, play / levels / daily.
   Opens over the board (mode 'menu'); play returns to wherever the player
   was. The home heart in the header re-opens it. */
import { SPR } from '../sprites';
import { localToday } from '../gen/daily';
import { mountWordmark } from './logo';
import { resetProgress } from './persist';
import type { Session } from './session';

const CAST_POOL = [
  'penguin', 'bunny', 'frog', 'bear', 'ghost', 'pig', 'cat', 'panda', 'chick', 'balloon'
];

export interface StartDeps {
  s: Session;
  onPlay: () => void;
  onDaily: () => void;
  onLevels: () => void;
  unlockAudio: () => void;
}

export interface Start {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

export function createStart(d: StartDeps): Start {
  const { s } = d;
  const el = document.getElementById('start') as HTMLElement;
  const sc = document.getElementById('startc') as HTMLCanvasElement;
  let raf = 0;

  /* the one-and-only logo, mounted once (SSOT) */
  const startLogo = document.getElementById('startLogo');
  if (startLogo) mountWordmark(startLogo);

  /* three friends join Squishy on the shelf, rotating with the date */
  const dayN = Math.abs(localToday().split('-').reduce((a, b) => a + Number(b), 0));
  const cast = ['squishy',
    CAST_POOL[dayN % CAST_POOL.length] as string,
    CAST_POOL[(dayN + 3) % CAST_POOL.length] as string,
    CAST_POOL[(dayN + 7) % CAST_POOL.length] as string
  ];

  const drawShelf = (now: number): void => {
    const ctx = sc.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = sc.clientWidth || 330;
    const h = sc.clientHeight || 120;
    sc.width = w * dpr;
    sc.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cast.forEach((kind, i) => {
      const x = (w / (cast.length + 1)) * (i + 1);
      const hopP = Math.max(0, Math.sin(now * 0.0012 + i * 1.7));
      const hop = hopP > 0.94 ? Math.sin((hopP - 0.94) / 0.06 * Math.PI) * 8 : 0;
      SPR[kind]?.(ctx, {
        x, y: h * 0.56 - hop, cell: 86, now, idle: true,
        mood: 'happy', seed: i * 5 + 2
      });
    });
  };

  const loop = (now: number): void => {
    if (!el.classList.contains('show')) return;
    drawShelf(now);
    raf = requestAnimationFrame(loop);
  };

  const open = (): void => {
    if (el.classList.contains('show')) return;
    s.mode = 'menu';
    el.classList.add('show');
    const dd = document.getElementById('bdailyDate');
    if (dd) dd.textContent = localToday().slice(5);
    /* the primary button reflects the campaign level the player will resume:
       no progress (li 0) reads "Play / LEVEL 1"; otherwise "Continue / LEVEL N" */
    const n = s.li + 1;
    const main = el.querySelector('.bp-main');
    if (main) main.textContent = s.li > 0 ? 'Continue' : 'Play';
    const sub = document.getElementById('bplaySub');
    if (sub) sub.textContent = 'LEVEL ' + n;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  };

  const close = (): void => {
    el.classList.remove('show');
    cancelAnimationFrame(raf);
    if (s.mode === 'menu') s.mode = 'idle';
  };

  const bind = (id: string, fn: () => void): void => {
    document.getElementById(id)?.addEventListener('click', () => {
      d.unlockAudio();
      fn();
    });
  };
  bind('bplay', () => {
    close();
    d.onPlay();
  });
  bind('bdaily', () => {
    close();
    d.onDaily();
  });
  bind('blevels', () => d.onLevels());
  /* tapping the "Squishy & Friends" wordmark (the only thing in #brand now)
     returns to the start screen */
  bind('brand', () => {
    if (s.mode === 'idle') open();
  });

  /* Reset progress — one tap arms, a second within 3s wipes and reloads */
  const breset = document.getElementById('breset');
  let armed = false;
  let armTimer = 0;
  breset?.addEventListener('click', () => {
    d.unlockAudio();
    if (!armed) {
      armed = true;
      breset.textContent = 'Tap again to reset';
      armTimer = window.setTimeout(() => {
        armed = false;
        breset.textContent = 'Reset progress';
      }, 3000);
      return;
    }
    clearTimeout(armTimer);
    resetProgress();
    location.reload();
  });

  return { open, close, isOpen: () => el.classList.contains('show') };
}
