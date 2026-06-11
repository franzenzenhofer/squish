/* Intro specs — pure data describing each friend's "how do I move" demo:
   a 3-tile strip, swipe chevrons, and keyframed motion. */

export type IntroTile = 'floor' | 'wall' | 'ice' | 'nom' | 'star';

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
  kind: string;
  name: string;
  line: string;
  tiles: [IntroTile, IntroTile, IntroTile];
  /** chevron flash times within the loop (the "swipe") */
  chevrons: number[];
  keys: IntroKey[];
  /** a squishy slides in from the left and shoves (pig) */
  pusher?: boolean;
  /** tile index that vanishes (eaten star / scared nomster) and when */
  clearTile?: { at: number; t: number };
  /** rotate the actor at the end (cat bonk-turn) */
  bumpTurn?: boolean;
}

export const LOOP_MS = 2600;

export const INTRO_SPECS: Record<string, IntroSpec> = {
  penguin: {
    kind: 'penguin', name: 'penguin', line: 'glides over thin ice',
    tiles: ['floor', 'ice', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1100, x: 2 }]
  },
  bunny: {
    kind: 'bunny', name: 'bunny', line: 'hops two squares - right over things',
    tiles: ['floor', 'wall', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 900, x: 2, hop: true }]
  },
  frog: {
    kind: 'frog', name: 'froggy', line: 'leaps all the way to the next wall',
    tiles: ['floor', 'floor', 'wall'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 800, x: 1, hop: true }]
  },
  bear: {
    kind: 'bear', name: 'bear', line: 'plods two steps, scares nomsters away',
    tiles: ['floor', 'floor', 'nom'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1200, x: 1 }],
    clearTile: { at: 2, t: 1300 }
  },
  ghost: {
    kind: 'ghost', name: 'ghostie', line: 'floats straight through walls',
    tiles: ['floor', 'wall', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1300, x: 2 }]
  },
  star: {
    kind: 'dot', name: 'star', line: 'collect every star to open the heart',
    tiles: ['floor', 'floor', 'star'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 1000, x: 2 }],
    clearTile: { at: 2, t: 1000 }
  },
  pig: {
    kind: 'pig', name: 'piggy', line: 'bump her and she scoots one square',
    tiles: ['floor', 'floor', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 1 }, { t: 700, x: 1 }, { t: 1100, x: 2 }],
    pusher: true
  },
  cat: {
    kind: 'cat', name: 'kitty', line: 'turns right when she bumps into things',
    tiles: ['floor', 'wall', 'floor'], chevrons: [200],
    keys: [{ t: 0, x: 0 }, { t: 300, x: 0 }, { t: 800, x: 0.62 }, { t: 1100, x: 0.55 }],
    bumpTurn: true
  },
  panda: {
    kind: 'panda', name: 'panda', line: 'sleepy - he moves every second swipe',
    tiles: ['floor', 'floor', 'floor'], chevrons: [200, 1400],
    keys: [{ t: 0, x: 0 }, { t: 600, x: 0, zzz: true }, { t: 1500, x: 0 }, { t: 2100, x: 1 }]
  },
  chick: {
    kind: 'chick', name: 'chick', line: 'copies your previous swipe',
    tiles: ['floor', 'floor', 'floor'], chevrons: [200, 1400],
    keys: [{ t: 0, x: 0 }, { t: 1500, x: 0 }, { t: 2100, x: 1 }]
  }
};
