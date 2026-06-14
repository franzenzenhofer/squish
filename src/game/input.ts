/* Input — pointer swipes, keyboard, footer buttons. Pure wiring: every
   gesture maps to a semantic action provided by the orchestrator. */
import type { Dir } from '../engine/types';

export interface InputActions {
  doMove: (d: Dir) => void;
  undo: () => void;
  retry: () => void;
  hint: () => void;
  advance: () => void;
  toggleMute: () => void;
  /** true while the win modal is up — taps advance instead of swiping */
  inWin: () => boolean;
  /** a tap (no drag) on the board — show what that cell holds */
  onTap: (clientX: number, clientY: number) => void;
  unlockAudio: () => void;
}

const KEYMAP: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right'
};

export function bindInput(main: HTMLElement, a: InputActions): void {
  let pStart: { x: number; y: number } | null = null;
  let pFired = false;

  const fireSwipe = (dx: number, dy: number): void => {
    a.doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };

  main.addEventListener('pointerdown', (e) => {
    a.unlockAudio();
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
    if (a.inWin()) {
      if (!pFired) a.advance();
      pStart = null;
      return;
    }
    if (pStart && !pFired) {
      const dx = e.clientX - pStart.x;
      const dy = e.clientY - pStart.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= 16) fireSwipe(dx, dy);
      else a.onTap(e.clientX, e.clientY);
    }
    pStart = null;
  });
  /* swallow page panning/bounce for game input, but anything that must scroll
     natively on iOS (the overlays AND the builder's tool palette) is excluded —
     otherwise this preventDefault kills their touch scrolling entirely */
  document.addEventListener('touchmove', (e) => {
    if ((e.target as HTMLElement).closest('#levels, #settings, #privacy, #bPalette')) return;
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('keydown', (e) => {
    a.unlockAudio();
    if (a.inWin() && (e.key === ' ' || e.key === 'Enter')) {
      a.advance();
      return;
    }
    const d = KEYMAP[e.key];
    if (d) {
      e.preventDefault();
      a.doMove(d);
    } else if (e.key === 'u') a.undo();
    else if (e.key === 'r') a.retry();
    else if (e.key === 'h') a.hint();
    else if (e.key === 'm') a.toggleMute();
  });

  const bind = (id: string, fn: () => void): void => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', () => {
        a.unlockAudio();
        fn();
      });
    }
  };
  bind('undo', a.undo);
  bind('retry', a.retry);
  bind('hint', a.hint);
  bind('mute', a.toggleMute);
}
