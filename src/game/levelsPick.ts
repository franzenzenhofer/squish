/* Level picker — a card per level: the number ALWAYS visible, earned hearts,
   and the level's cast as mini icons painted by the one sprite painter
   (SSOT). States: done (solved, sealed, replayable), open (the next
   reachable level, highlighted), locked (beyond reach, dimmed). A
   hint-helped level is done but heartless until re-solved hint-free.
   The ∞ chip continues endless play. With ?debug=doit every card unlocks
   and extra sections appear: the generated ladder, marathon milestones,
   hand-authored test levels and the hardness baker. */
import type { LevelDef } from '../engine/types';
import { SPR } from '../sprites';
import { DEBUG_GEN_COUNT, isDebug } from './debugMode';
import { DEBUG_LEVELS } from './debugLevels';
import { CURATED, type Session } from './session';

export interface LevelsDeps {
  s: Session;
  onPick: (li: number) => void;
  /** play a hand-authored test level (index into DEBUG_LEVELS) */
  onPickTest: (di: number) => void;
  /** bake + play a one-off level at hardness 1..10; true = now playing */
  onBake: (hardness: number) => Promise<boolean>;
  unlockAudio: () => void;
}

export interface LevelsPick {
  open: () => void;
  close: () => void;
}

/** 'free' = debug-unlocked: playable, plain number, no padlock */
type ChipState = 'done' | 'open' | 'locked' | 'free';

/** def array key -> sprite id, in display order (friends, movers, nomster) */
const CAST_KEYS: ReadonlyArray<readonly [keyof LevelDef, string]> = [
  ['penguins', 'penguin'], ['bunnies', 'bunny'], ['frogs', 'frog'],
  ['bears', 'bear'], ['ghosts', 'ghost'], ['pandas', 'panda'],
  ['cats', 'cat'], ['chicks', 'chick'], ['pigs', 'pig'],
  ['stars', 'star'], ['boxes', 'box'], ['balloons', 'balloon'],
  ['snails', 'snail'], ['noms', 'nomster']
];

/** Sprite kinds present on a level, in display order. */
function castOf(def: LevelDef): string[] {
  const out: string[] = [];
  for (const [key, kind] of CAST_KEYS) {
    const arr = def[key];
    if (Array.isArray(arr) && arr.length > 0) out.push(kind);
  }
  return out;
}

/* mini icons: each kind painted ONCE by the gameplay sprite painter (SSOT)
   into a small offscreen canvas, reused as an <img> on every card */
const ICON_CSS = 18;
const ICON_SCALE = 2;
const iconCache = new Map<string, string>();

function iconUrl(kind: string): string {
  const hit = iconCache.get(kind);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = ICON_CSS * ICON_SCALE;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.scale(ICON_SCALE, ICON_SCALE);
  SPR[kind]?.(ctx, {
    x: ICON_CSS / 2, y: ICON_CSS * 0.62, cell: ICON_CSS * 0.92,
    now: 0, idle: true, mood: 'happy', seed: 3
  });
  const url = c.toDataURL();
  iconCache.set(kind, url);
  return url;
}

/* Marketing showcase: the picker displays cards all the way to 200 so players
   see the journey does not stop at the 50 curated levels. Cards 51-200 are the
   auto-generated endless ladder (the live ongoing-levels logic is unchanged) -
   their cast is decided at generation time, so they show a '?' instead. */
const SHOWCASE_LEVELS = 200;

function hearts(s: Session, li: number): string {
  const best = s.results[li];
  const cur = CURATED[li] as LevelDef | undefined;
  if (best === undefined || !cur) return '';
  const par = cur.par;
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
function nextOpen(s: Session, reach: number, total: number): number {
  for (let i = 0; i <= reach && i < total; i++) {
    if (!isDone(s, i)) return i;
  }
  return Math.min(reach, total - 1);
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

  /** One level card: number (always), state badge, hearts, cast icons. */
  const card = (li: number, state: ChipState): HTMLButtonElement => {
    const b = document.createElement('button');
    b.className = 'lvcard ' + state;
    const num = document.createElement('span');
    num.className = 'lvnum';
    num.textContent = String(li + 1);
    b.appendChild(num);
    if (state === 'done' || state === 'locked') {
      const badge = document.createElement('span');
      badge.className = 'lvbadge';
      badge.textContent = state === 'done' ? '✓' : '🔒';
      b.appendChild(badge);
    }
    const hs = document.createElement('span');
    hs.className = 'lvhearts';
    hs.textContent = state === 'done' ? hearts(s, li) : '';
    b.appendChild(hs);
    const cast = document.createElement('span');
    cast.className = 'lvcast';
    const curated = CURATED[li] as LevelDef | undefined;
    if (curated) {
      for (const kind of castOf(curated)) {
        const img = document.createElement('img');
        img.src = iconUrl(kind);
        img.alt = kind;
        cast.appendChild(img);
      }
    } else {
      /* auto-generated level (51-200): its cast is chosen when it is generated,
         so tease it with a '?' instead of a known friend line-up */
      const q = document.createElement('span');
      q.className = 'lvq';
      q.textContent = '?';
      cast.appendChild(q);
    }
    b.appendChild(cast);
    if (state !== 'locked') {
      b.addEventListener('click', () => {
        d.unlockAudio();
        close();
        d.onPick(li);
      });
    }
    return b;
  };

  /** Small round chip (∞ / generated ladder / milestones). */
  const chip = (label: string, pick: () => void, done = false): HTMLButtonElement => {
    const b = document.createElement('button');
    b.className = 'lvchip' + (done ? ' done' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      d.unlockAudio();
      close();
      pick();
    });
    return b;
  };

  const section = (title: string): void => {
    const h = document.createElement('div');
    h.className = 'lvsec';
    h.textContent = title;
    inner.appendChild(h);
  };

  /* milestone rungs of the endless ladder — jump straight to the marathon
     levels (par climbs ~19 at L100 to ~30 at L200) to see them */
  const MILESTONES = [70, 80, 100, 125, 150, 175, 200];

  /* debug-only: the generated ladder, test levels and the hardness baker */
  const buildDebugSections = (): void => {
    section('GENERATED');
    const g = document.createElement('div');
    g.id = 'levelsGen';
    g.className = 'lvchips';
    for (let i = 0; i < DEBUG_GEN_COUNT; i++) {
      const li = CURATED.length + i;
      g.appendChild(chip(String(li + 1), () => d.onPick(li), isDone(s, li)));
    }
    for (const n of MILESTONES) {
      g.appendChild(chip(String(n), () => d.onPick(n - 1), isDone(s, n - 1)));
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
      void d.onBake(bakeHardness)
        .then((ok) => {
          /* success: reveal the fresh level; failure: stay to retry */
          if (ok) close();
        })
        .finally(() => {
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
    /* debug keeps the curated grid + its own GENERATED/TEST/BAKE sections; the
       shipping picker shows the full 200-level showcase (50 curated, then the
       auto-generated ladder as '?' teasers) so players see it goes well past 50 */
    const total = isDebug() ? CURATED.length : SHOWCASE_LEVELS;
    const openIdx = nextOpen(s, reach, total);
    for (let i = 0; i < total; i++) {
      grid.appendChild(card(i, chipState(s, i, openIdx)));
    }
    if (!isDebug() && reach >= SHOWCASE_LEVELS) {
      grid.appendChild(chip('∞', () =>
        d.onPick(Math.max(SHOWCASE_LEVELS, s.play.kind === 'campaign' ? s.li : 0))));
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
