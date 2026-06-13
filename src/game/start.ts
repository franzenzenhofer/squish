/* Start screen — title, a shelf of idling friends, play / levels / daily.
   Opens over the board (mode 'menu'); play returns to wherever the player
   was. The home heart in the header re-opens it. */
import { SPR } from '../sprites';
import { localToday } from '../gen/daily';
import { mountWordmark } from './logo';
import type { Session } from './session';

const CAST_POOL = [
  'penguin', 'bunny', 'frog', 'bear', 'ghost', 'pig', 'cat', 'panda', 'chick', 'balloon'
];

export interface StartDeps {
  s: Session;
  onPlay: () => void;
  onDaily: () => void;
  onLevels: () => void;
  onSettings: () => void;
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

  /* Squishy always leads the shelf; THREE UNIQUE friends join in random
     order, re-rolled every time the start screen opens (new visit or a
     mid-session return) — a full shuffle then slice guarantees uniqueness */
  let cast: string[] = ['squishy'];
  const reshuffleCast = (): void => {
    const pool = [...CAST_POOL];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j] as string, pool[i] as string];
    }
    cast = ['squishy', ...pool.slice(0, 3)];
  };
  reshuffleCast();

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
    reshuffleCast();
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
  /* Reset progress lives in here now — the start screen stays pure play */
  bind('bsettings', () => d.onSettings());
  /* tapping the "Squishy & Friends" wordmark (the only thing in #brand now)
     returns to the start screen */
  bind('brand', () => {
    if (s.mode === 'idle') open();
  });

  return { open, close, isOpen: () => el.classList.contains('show') };
}
