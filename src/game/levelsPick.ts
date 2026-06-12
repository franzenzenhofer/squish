/* Level picker — a grid of chips with earned hearts. Each chip is one of three
   states: done (solved, sealed, replayable), open (the next reachable level,
   highlighted), or locked (beyond reach, padlocked). A hint-helped level is
   done but heartless until it is re-solved hint-free. The ∞ chip continues
   endless play. With ?debug=doit every chip unlocks and two extra sections
   appear: the generated 41-50 ladder, and the hand-authored test levels plus
   the hardness baker. */
import type { LevelDef } from '../engine/types';
import { DEBUG_GEN_COUNT, isDebug } from './debugMode';
import { DEBUG_LEVELS } from './debugLevels';
import { CURATED, type Session } from './session';

export interface LevelsDeps {
  s: Session;
  onPick: (li: number) => void;
  /** play a hand-authored test level (index into DEBUG_LEVELS) */
  onPickTest: (di: number) => void;
  /** bake + play a one-off level at hardness 1..10; resolves when settled */
  onBake: (hardness: number) => Promise<void>;
  unlockAudio: () => void;
}

export interface LevelsPick {
  open: () => void;
  close: () => void;
}

/** 'free' = debug-unlocked: playable, plain number, no padlock */
type ChipState = 'done' | 'open' | 'locked' | 'free';

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
  for (const k of Object.keys(s.hinted)) m = Math.max(m, Number(k) + 1);
  return m;
}

function isDone(s: Session, li: number): boolean {
  return s.results[li] !== undefined || s.hinted[li] === true;
}

/** Lowest reachable level that is not yet solved — the single "open" level. */
function nextOpen(s: Session, reach: number): number {
  for (let i = 0; i <= reach && i < CURATED.length; i++) {
    if (!isDone(s, i)) return i;
  }
  return Math.min(reach, CURATED.length - 1);
}

function chipState(s: Session, li: number, open: number): ChipState {
  if (isDone(s, li)) return 'done';
  if (li === open) return 'open';
  return isDebug() ? 'free' : 'locked';
}

export function createLevelsPick(d: LevelsDeps): LevelsPick {
  const { s } = d;
  const el = document.getElementById('levels') as HTMLElement;
  const grid = document.getElementById('levelsGrid') as HTMLElement;
  const inner = document.getElementById('levelsInner') as HTMLElement;
  let bakeHardness = 5;

  const chip = (cls: string, pick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.className = 'lvchip ' + cls;
    b.addEventListener('click', () => {
      d.unlockAudio();
      close();
      pick();
    });
    return b;
  };

  const numChip = (li: number, state: ChipState): HTMLButtonElement => {
    const b = chip(state, () => d.onPick(li));
    const num = document.createElement('span');
    num.textContent =
      state === 'locked' ? '🔒' : state === 'done' ? '✓' : String(li + 1);
    const mini = document.createElement('span');
    mini.className = 'mini';
    mini.textContent = li < CURATED.length ? hearts(s, li) : '';
    b.append(num, mini);
    return b;
  };

  const section = (title: string): void => {
    const h = document.createElement('div');
    h.className = 'lvsec';
    h.textContent = title;
    inner.appendChild(h);
  };

  /* debug-only: the test-level list and the hardness baker */
  const buildDebugSections = (): void => {
    section('GENERATED');
    const g = document.createElement('div');
    g.id = 'levelsGen';
    g.style.cssText = 'display:grid;grid-template-columns:repeat(5,52px);gap:10px;padding:6px';
    for (let i = 0; i < DEBUG_GEN_COUNT; i++) {
      const li = CURATED.length + i;
      const b = chip(isDone(s, li) ? 'done' : '', () => d.onPick(li));
      const num = document.createElement('span');
      num.textContent = isDone(s, li) ? '✓' : String(li + 1);
      b.appendChild(num);
      g.appendChild(b);
    }
    inner.appendChild(g);

    section('TEST LEVELS');
    const list = document.createElement('div');
    list.className = 'lvtest';
    DEBUG_LEVELS.forEach((t, di) => {
      const b = document.createElement('button');
      const name = document.createElement('span');
      name.textContent = 'T' + (di + 1) + ' · ' + t.name;
      const mini = document.createElement('span');
      mini.className = 'mini';
      mini.textContent = t.def.w + 'x' + t.def.h + ' · par ' + t.def.par;
      b.append(name, mini);
      b.addEventListener('click', () => {
        d.unlockAudio();
        close();
        d.onPickTest(di);
      });
      list.appendChild(b);
    });
    inner.appendChild(list);

    section('BAKE A LEVEL');
    const bake = document.createElement('div');
    bake.className = 'lvbake';
    const lab = document.createElement('span');
    lab.className = 'bk';
    const minus = document.createElement('button');
    minus.textContent = '−';
    const plus = document.createElement('button');
    plus.textContent = '+';
    const go = document.createElement('button');
    go.className = 'bkgo';
    go.textContent = 'Bake';
    const reflect = (): void => {
      lab.textContent = 'Hardness ' + bakeHardness + '/10';
    };
    minus.addEventListener('click', () => {
      bakeHardness = Math.max(1, bakeHardness - 1);
      reflect();
    });
    plus.addEventListener('click', () => {
      bakeHardness = Math.min(10, bakeHardness + 1);
      reflect();
    });
    go.addEventListener('click', () => {
      d.unlockAudio();
      go.disabled = true;
      go.textContent = 'Baking…';
      void d.onBake(bakeHardness).finally(() => {
        go.disabled = false;
        go.textContent = 'Bake';
      });
    });
    reflect();
    bake.append(lab, minus, plus, go);
    inner.appendChild(bake);
  };

  const rebuild = (): void => {
    grid.textContent = '';
    for (const stale of inner.querySelectorAll('.lvsec, .lvtest, .lvbake, #levelsGen')) {
      stale.remove();
    }
    const reach = furthest(s);
    const openIdx = nextOpen(s, reach);
    for (let i = 0; i < CURATED.length; i++) {
      grid.appendChild(numChip(i, chipState(s, i, openIdx)));
    }
    if (!isDebug() && reach >= CURATED.length) {
      const b = chip('', () =>
        d.onPick(Math.max(CURATED.length, s.play.kind === 'campaign' ? s.li : 0)));
      b.textContent = '∞';
      grid.appendChild(b);
    }
    if (isDebug()) buildDebugSections();
  };

  const open = (): void => {
    rebuild();
    el.classList.add('show');
    el.scrollTop = 0;
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
