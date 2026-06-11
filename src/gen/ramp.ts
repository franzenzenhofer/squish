/* Difficulty ramp — pure data. Decides board size, par band, featured
   friends/fields and solver budgets for every level number. */

export type FriendKind =
  | 'penguin' | 'bunny' | 'frog' | 'bear' | 'ghost'
  | 'star' | 'pig' | 'cat' | 'panda' | 'chick';

export type FieldKind =
  | 'sticky' | 'oneway' | 'split' | 'portal' | 'turn'
  | 'ice' | 'mush' | 'breeze' | 'jelly' | 'nom';

export type ClassicKind = 'box' | 'balloon' | 'snail';

export interface RampParams {
  w: number;
  h: number;
  parMin: number;
  parTarget: number;
  /** hard ceiling — candidates above this par are rejected */
  parMax: number;
  /** how many featured friend/field groups the optimal line must actually
      use; omitted = all of them */
  featureUseMin?: number;
  dots: number;
  friends: FriendKind[];
  fields: FieldKind[];
  classics: ClassicKind[];
  wallMax: number;
  attempts: number;
  maxStates: number;
}

export const FRIEND_ROTATION: readonly FriendKind[] = [
  'penguin', 'bunny', 'frog', 'bear', 'ghost', 'star', 'pig', 'cat', 'panda', 'chick'
];

/** Optimal line must show these flags for a featured friend (any one of). */
export const FRIEND_FLAGS: Record<FriendKind, string[]> = {
  penguin: ['penguinmove'],
  bunny: ['bunnymove'],
  frog: ['frogmove'],
  bear: ['scare', 'bearmove'],
  ghost: ['ghostmove'],
  star: ['collect'],
  pig: ['shove'],
  cat: ['catturn', 'catmove'],
  panda: ['pandamove'],
  chick: ['chickmove']
};

export const FIELD_FLAGS: Record<FieldKind, string[]> = {
  sticky: ['sticky'],
  oneway: ['oneway'],
  split: ['split'],
  portal: ['beam'],
  turn: ['turn'],
  ice: ['crack', 'penguinmove'],
  mush: ['bounce'],
  breeze: ['wind'],
  jelly: ['hop'],
  nom: ['nom', 'feed', 'scare', 'shove']
};

/* Curated 4..40: every friend introduced solo, then paired with fields,
   then combined. Tutorials 1..3 are hand-made elsewhere. */
const CURATED: Record<number, Partial<RampParams>> = {
  4: { friends: ['penguin'], fields: ['ice'] },
  5: { friends: ['bunny'], fields: [] },
  6: { friends: ['frog'], fields: [] },
  7: { friends: ['bear'], fields: ['nom'] },
  8: { friends: ['ghost'], fields: [] },
  9: { friends: ['star'], fields: [] },
  10: { friends: ['pig'], fields: ['nom'] },
  11: { friends: ['cat'], fields: [] },
  12: { friends: ['panda'], fields: [] },
  13: { friends: ['chick'], fields: [] },
  14: { friends: ['penguin'], fields: ['ice', 'sticky'] },
  15: { friends: ['bunny'], fields: ['oneway'] },
  16: { friends: ['frog'], fields: ['portal'] },
  17: { friends: ['bear'], fields: ['nom', 'split'] },
  18: { friends: ['ghost'], fields: ['ice'] },
  19: { friends: ['star'], fields: ['jelly'] },
  20: { friends: ['pig'], fields: ['nom', 'turn'] },
  21: { friends: ['cat'], fields: ['mush'] },
  22: { friends: ['panda'], fields: ['breeze'] },
  23: { friends: ['chick'], fields: ['sticky'] },
  24: { friends: [], fields: ['nom', 'split'], classics: ['box', 'balloon'] },
  25: { friends: [], fields: ['split', 'portal'], classics: ['snail'] },
  /* first multi-friend levels ramp gently: 5-6 -> 7 -> 7, no par-9 cliff */
  26: { friends: ['penguin', 'bunny'], fields: ['ice'], parTarget: 5, parMax: 6 },
  27: { friends: ['frog', 'star'], fields: ['portal'], parMax: 7 },
  28: { friends: ['bear', 'pig'], fields: ['nom'], parMax: 7 },
  29: { friends: ['ghost', 'cat'], fields: ['oneway'] },
  30: { friends: ['panda', 'chick'], fields: [] },
  31: { friends: ['bunny', 'star'], fields: ['jelly'] },
  32: { friends: ['penguin', 'frog'], fields: ['ice', 'mush'] },
  33: { friends: ['bear', 'ghost'], fields: ['nom', 'split'] },
  34: { friends: ['cat', 'pig'], fields: ['turn'] },
  35: { friends: ['star', 'chick'], fields: ['sticky'] },
  36: { friends: ['bunny', 'pig'], fields: ['nom', 'oneway'] },
  37: { friends: ['penguin', 'cat'], fields: ['ice', 'breeze'] },
  38: { friends: ['frog', 'ghost'], fields: ['portal'] },
  39: { friends: ['bear', 'star'], fields: ['split'] },
  40: { friends: ['pig', 'star', 'bunny'], fields: ['nom', 'jelly'] }
};

const ENDLESS_FIELDS: readonly FieldKind[] = [
  'sticky', 'oneway', 'split', 'portal', 'turn', 'ice', 'mush', 'breeze', 'jelly', 'nom'
];

export function ramp(n: number): RampParams {
  /* base curve */
  const base: RampParams = {
    w: 5, h: 5, parMin: 4, parTarget: 4, parMax: 7, dots: 1,
    friends: [], fields: [], classics: [], wallMax: 4,
    attempts: 90, maxStates: 60000
  };
  if (n <= 40) {
    const c = CURATED[n] ?? {};
    const tier = n <= 13 ? 0 : n <= 25 ? 1 : 2;
    base.w = base.h = tier === 0 ? 5 : tier === 1 ? 6 : n >= 38 ? 7 : 6;
    base.parTarget = tier === 0 ? 4 : tier === 1 ? 5 : 6 + Math.floor((n - 26) / 5);
    base.parMax = base.parTarget + 3;
    base.parMin = 4;
    base.dots = tier === 0 ? (n % 2 === 0 ? 1 : 2) : 2;
    base.wallMax = tier === 0 ? 4 : tier === 1 ? 6 : 8;
    base.attempts = 600;
    base.maxStates = 400000;
    return { ...base, friends: [], fields: [], classics: [], ...c };
  }
  /* endless 41+ */
  const k = n - 41;
  const tier = k < 15 ? 0 : k < 35 ? 1 : k < 60 ? 2 : 3;
  base.w = base.h = tier === 0 ? 5 : tier <= 2 ? 6 : 7;
  base.parMin = tier === 0 ? 4 : tier === 1 ? 4 : 5;
  base.parTarget = Math.min(12, 4 + Math.floor(k / 10));
  base.parMax = base.parTarget + 3;
  base.dots = tier === 0 ? 1 + (k % 2) : tier === 1 ? 2 : 2 + (k % 2);
  base.wallMax = 4 + tier * 2;
  base.attempts = 80;
  base.maxStates = tier === 0 ? 30000 : 50000;
  const featured = FRIEND_ROTATION[k % 10] as FriendKind;
  base.friends = [featured];
  if (tier >= 2) base.friends.push(FRIEND_ROTATION[(k * 3 + 1) % 10] as FriendKind);
  /* panda/chick multiply the BFS state space — shrink the board for them */
  if (base.friends.includes('panda') || base.friends.includes('chick')) {
    base.w = base.h = Math.max(5, base.w - 1);
    base.maxStates = Math.floor(base.maxStates / 2);
  }
  base.fields = tier === 0 ? [] : [ENDLESS_FIELDS[(k * 7 + 3) % ENDLESS_FIELDS.length] as FieldKind];
  if (tier >= 2) base.fields.push(ENDLESS_FIELDS[(k * 5 + 1) % ENDLESS_FIELDS.length] as FieldKind);
  if (k % 3 === 1) base.classics = [(['box', 'balloon', 'snail'] as const)[k % 3] as ClassicKind];
  return base;
}
