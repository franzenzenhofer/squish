/* Level picker — a grid of chips with earned hearts. Levels beyond the
   player's furthest point are padlocked. The ∞ chip continues endless play. */
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

function hearts(s: Session, li: number): string {
  const best = s.results[li];
  if (best === undefined) return '';
  const par = (CURATED[li] as LevelDef).par;
  const n = best <= par ? 3 : best <= par + 1 ? 2 : 1;
  return '♥'.repeat(n);
}

export function createLevelsPick(d: LevelsDeps): LevelsPick {
  const { s } = d;
  const el = document.getElementById('levels') as HTMLElement;
  const grid = document.getElementById('levelsGrid') as HTMLElement;

  const maxUnlocked = (): number => {
    let m = s.play.kind === 'campaign' ? s.li : 0;
    for (const k of Object.keys(s.results)) m = Math.max(m, Number(k) + 1);
    return m;
  };

  const rebuild = (): void => {
    grid.textContent = '';
    const unlocked = maxUnlocked();
    for (let i = 0; i < CURATED.length; i++) {
      const chip = document.createElement('button');
      chip.className = 'lvchip' + (i > unlocked ? ' locked' : '');
      const num = document.createElement('span');
      num.textContent = i > unlocked ? '🔒' : String(i + 1);
      const mini = document.createElement('span');
      mini.className = 'mini';
      mini.textContent = hearts(s, i);
      chip.append(num, mini);
      chip.addEventListener('click', () => {
        d.unlockAudio();
        close();
        d.onPick(i);
      });
      grid.appendChild(chip);
    }
    if (unlocked >= CURATED.length) {
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
