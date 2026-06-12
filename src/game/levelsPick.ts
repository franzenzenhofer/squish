/* Level picker — a grid of chips with earned hearts. Each chip is one of three
   states: done (solved, sealed, replayable), open (the next reachable level,
   highlighted), or locked (beyond reach, padlocked). The ∞ chip continues
   endless play. */
import type { LevelDef } from '../engine/types';
import { CURATED, type Session } from './session';

export interface LevelsDeps {
  s: Session;
  onPick: (li: number) => void;
  unlockAudio: () => void;
}

export interface LevelsPick {
  open: () => void;
  close: () => void;
}

type ChipState = 'done' | 'open' | 'locked';

function hearts(s: Session, li: number): string {
  const best = s.results[li];
  if (best === undefined) return '';
  const par = (CURATED[li] as LevelDef).par;
  const n = best <= par ? 3 : best <= par + 1 ? 2 : 1;
  return '♥'.repeat(n);
}

/** Furthest level the player has reached (the highest index they may play). */
function furthest(s: Session): number {
  let m = s.play.kind === 'campaign' ? s.li : 0;
  for (const k of Object.keys(s.results)) m = Math.max(m, Number(k) + 1);
  return m;
}

/** Lowest reachable level that is not yet solved — the single "open" level. */
function nextOpen(s: Session, reach: number): number {
  for (let i = 0; i <= reach && i < CURATED.length; i++) {
    if (s.results[i] === undefined) return i;
  }
  return Math.min(reach, CURATED.length - 1);
}

function chipState(s: Session, li: number, reach: number, open: number): ChipState {
  if (s.results[li] !== undefined) return 'done';
  if (li > reach) return 'locked';
  return li === open ? 'open' : 'locked';
}

export function createLevelsPick(d: LevelsDeps): LevelsPick {
  const { s } = d;
  const el = document.getElementById('levels') as HTMLElement;
  const grid = document.getElementById('levelsGrid') as HTMLElement;

  const rebuild = (): void => {
    grid.textContent = '';
    const reach = furthest(s);
    const openIdx = nextOpen(s, reach);
    for (let i = 0; i < CURATED.length; i++) {
      const state = chipState(s, i, reach, openIdx);
      const chip = document.createElement('button');
      chip.className = 'lvchip ' + state;
      const num = document.createElement('span');
      num.textContent =
        state === 'locked' ? '🔒' : state === 'done' ? '✓' : String(i + 1);
      const mini = document.createElement('span');
      mini.className = 'mini';
      mini.textContent = hearts(s, i);
      chip.append(num, mini);
      if (state !== 'locked') {
        chip.addEventListener('click', () => {
          d.unlockAudio();
          close();
          d.onPick(i);
        });
      }
      grid.appendChild(chip);
    }
    if (reach >= CURATED.length) {
      const chip = document.createElement('button');
      chip.className = 'lvchip';
      chip.textContent = '∞';
      chip.addEventListener('click', () => {
        d.unlockAudio();
        close();
        d.onPick(Math.max(CURATED.length, s.play.kind === 'campaign' ? s.li : 0));
      });
      grid.appendChild(chip);
    }
  };

  const open = (): void => {
    rebuild();
    el.classList.add('show');
  };
  const close = (): void => {
    el.classList.remove('show');
  };

  document.getElementById('blback')?.addEventListener('click', () => {
    d.unlockAudio();
    close();
  });

  return { open, close };
}
