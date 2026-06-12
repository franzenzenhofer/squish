/* Intro specs — pure data describing each friend's or element's "how does this
   work" demo: a 3-tile strip, swipe chevrons, and keyframed motion. Friends
   star in their own demo; elements are demonstrated by a plain squishy. */

import type { Dir4 } from '../lib/types';

export type IntroTile =
  | 'floor' | 'wall' | 'ice' | 'nom' | 'star' | 'heart'
  | 'honey' | 'oneway' | 'split' | 'portal' | 'turn'
  | 'mushroom' | 'breeze' | 'jelly';

export interface IntroKey {
  /** keyframe time inside the loop (ms) */
  t: number;
  /** grid x (0..2) */
  x: number;
  hop?: boolean;
  /** show sleep bubbles instead of moving at this beat */
  zzz?: boolean;
}

export interface IntroSpec {
  /** met-key + portrait identity (friend/mover sprite or element field) */
  kind: string;
  name: string;
  line: string;
  /** sprite that performs the demo; defaults to the friend `kind` */
  actor?: string;
  tiles: [IntroTile, IntroTile, IntroTile];
  /** direction for a one-way / breeze tile and its portrait arrow */
  tileDir?: Dir4;
  /** chevron flash times within the loop (the "swipe") */
  chevrons: number[];
  keys: IntroKey[];
  /** a squishy slides in from the left and shoves (pig) */
  pusher?: boolean;
  /** tile index that vanishes (eaten star / scared nomster) and when */
  clearTile?: { at: number; t: number };
  /** rotate the actor at the end (cat bonk-turn, spinner) */
  bumpTurn?: boolean;
  /** actor teleports from tile `at` to tile `to` at time `t` (portal) */
  teleport?: { at: number; to: number; t: number };
  /** actor leaves a static twin on tile `at` after passing (splitter) */
  clone?: { at: number; t: number };
  /** actor is gobbled and disappears at this time (nomster) */
  vanish?: number;
}

export const LOOP_MS = 2600;

export const INTRO_SPECS: Record<string, IntroSpec> = {
  /* ---- friends ---------------------------------------------------------- */
  penguin: {
    kind: 'penguin', name: 'Penguin', line: 'Glides over thin ice',
    tiles: ['floor', 'ice', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1100, x: 2 }]
  },
  bunny: {
    kind: 'bunny', name: 'Bunny', line: 'Hops two squares - right over things',
    tiles: ['floor', 'wall', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 900, x: 2, hop: true }]
  },
  frog: {
    kind: 'frog', name: 'Froggy', line: 'Leaps all the way to the next wall',
    tiles: ['floor', 'floor', 'wall'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 800, x: 1, hop: true }]
  },
  bear: {
    kind: 'bear', name: 'Bear', line: 'Plods two steps, scares nomsters away',
    tiles: ['floor', 'floor', 'nom'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1200, x: 1 }],
    clearTile: { at: 2, t: 1300 }
  },
  ghost: {
    kind: 'ghost', name: 'Ghostie', line: 'Floats straight through walls',
    tiles: ['floor', 'wall', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1300, x: 2 }]
  },
  star: {
    kind: 'dot', name: 'Star', line: 'Collect every star to open the heart',
    tiles: ['floor', 'floor', 'star'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1000, x: 2 }],
    clearTile: { at: 2, t: 1000 }
  },
  pig: {
    kind: 'pig', name: 'Piggy', line: 'Bump her and she scoots one square',
    tiles: ['floor', 'floor', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 1 }, { t: 700, x: 1 }, { t: 1100, x: 2 }],
    pusher: true
  },
  cat: {
    kind: 'cat', name: 'Kitty', line: 'Turns right when she bumps into things',
    tiles: ['floor', 'wall', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 800, x: 0.62 }, { t: 1100, x: 0.55 }],
    bumpTurn: true
  },
  panda: {
    kind: 'panda', name: 'Panda', line: 'Sleepy - he moves every second swipe',
    tiles: ['floor', 'floor', 'floor'], chevrons: [200, 1400],
    keys: [{ t: 0, x: 0 }, { t: 600, x: 0, zzz: true }, { t: 1500, x: 0 }, { t: 2100, x: 1 }]
  },
  chick: {
    kind: 'chick', name: 'Chick', line: 'Copies your previous swipe',
    tiles: ['floor', 'floor', 'floor'], chevrons: [200, 1400],
    keys: [{ t: 0, x: 0 }, { t: 1500, x: 0 }, { t: 2100, x: 1 }]
  },

  /* ---- other movers ----------------------------------------------------- */
  box: {
    kind: 'box', name: 'Crate', line: 'Slides along until something stops it',
    actor: 'box', tiles: ['floor', 'floor', 'wall'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1000, x: 1 }]
  },
  balloon: {
    kind: 'balloon', name: 'Balloon', line: 'Drifts the opposite way you swipe',
    actor: 'balloon', tiles: ['floor', 'floor', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 2 }, { t: 300, x: 2 }, { t: 1000, x: 0 }]
  },
  snail: {
    kind: 'snail', name: 'Snail', line: 'Creeps just one square at a time',
    actor: 'snail', tiles: ['floor', 'floor', 'floor'], chevrons: [200, 1400],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 900, x: 1 },
      { t: 1500, x: 1 }, { t: 2100, x: 2 }]
  },

  /* ---- board elements --------------------------------------------------- */
  wall: {
    kind: 'wall', name: 'Wall', line: 'Solid - nobody pushes past it',
    actor: 'squishy', tiles: ['floor', 'floor', 'wall'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 900, x: 1 }]
  },
  ice: {
    kind: 'ice', name: 'Ice', line: 'Slide across, then it cracks behind you',
    actor: 'squishy', tiles: ['floor', 'ice', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1100, x: 2 }],
    clearTile: { at: 1, t: 1000 }
  },
  nom: {
    kind: 'nom', name: 'Nomster', line: 'Keep away - it gobbles you up!',
    actor: 'squishy', tiles: ['floor', 'floor', 'nom'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1000, x: 2 }],
    vanish: 1050
  },
  heart: {
    kind: 'heart', name: 'The Heart', line: 'Slide onto the heart to win!',
    actor: 'squishy', tiles: ['floor', 'floor', 'heart'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1000, x: 2 }]
  },
  honey: {
    kind: 'honey', name: 'Honey', line: 'Sticky - you stop the moment you touch it',
    actor: 'squishy', tiles: ['floor', 'honey', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 900, x: 1 }]
  },
  oneway: {
    kind: 'oneway', name: 'One-way Gate', line: 'Pass only the way the arrows point',
    actor: 'squishy', tiles: ['floor', 'oneway', 'floor'], tileDir: 'right',
    chevrons: [200], keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1100, x: 2 }]
  },
  split: {
    kind: 'split', name: 'Splitter', line: 'Leaves a twin of you behind',
    actor: 'squishy', tiles: ['floor', 'split', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1100, x: 2 }],
    clone: { at: 1, t: 800 }
  },
  portal: {
    kind: 'portal', name: 'Portal', line: 'Step in - pop out its twin',
    actor: 'squishy', tiles: ['portal', 'floor', 'portal'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }],
    teleport: { at: 0, to: 2, t: 900 }
  },
  turn: {
    kind: 'turn', name: 'Spinner', line: 'Turns you a quarter-turn clockwise',
    actor: 'squishy', tiles: ['floor', 'turn', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 900, x: 1 }, { t: 1100, x: 1 }],
    bumpTurn: true
  },
  mushroom: {
    kind: 'mushroom', name: 'Mushroom', line: 'Bouncy - springs you back the way you came',
    actor: 'squishy', tiles: ['floor', 'floor', 'mushroom'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 900, x: 2 }, { t: 1500, x: 0 }]
  },
  breeze: {
    kind: 'breeze', name: 'Breeze', line: 'A gust carries you along its arrow',
    actor: 'squishy', tiles: ['floor', 'breeze', 'floor'], tileDir: 'right',
    chevrons: [200], keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1100, x: 2 }]
  },
  jelly: {
    kind: 'jelly', name: 'Jelly', line: 'Springs you two squares ahead',
    actor: 'squishy', tiles: ['jelly', 'floor', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1000, x: 2, hop: true }]
  }
};
