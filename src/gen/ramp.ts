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
  /** most stars a sketch may place when 'star' features (default 2) — more
      stars force longer collection tours, the main lever for very high par */
  starMax?: number;
  /** candidate choice within the par band: 'max' (default) takes the hardest,
      'exact' takes the one closest above parTarget — the endless ladder uses
      'exact' so wide acceptance bands don't overshoot the rung */
  parPrefer?: 'exact' | 'max';
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
  /* parMin floors on 28/33/34/40: the audited curve dipped there (par 5/6/6/8
     between par-8..10 neighbours) — the late game must never get easier */
  28: { friends: ['bear', 'pig'], fields: ['nom'], parMin: 6, parMax: 7 },
  29: { friends: ['ghost', 'cat'], fields: ['oneway'] },
  30: { friends: ['panda', 'chick'], fields: [] },
  31: { friends: ['bunny', 'star'], fields: ['jelly'] },
  32: { friends: ['penguin', 'frog'], fields: ['ice', 'mush'] },
  33: { friends: ['bear', 'ghost'], fields: ['nom', 'split'], parMin: 7 },
  34: { friends: ['cat', 'pig'], fields: ['turn'], parMin: 7 },
  35: { friends: ['star', 'chick'], fields: ['sticky'] },
  36: { friends: ['bunny', 'pig'], fields: ['nom', 'oneway'] },
  37: { friends: ['penguin', 'cat'], fields: ['ice', 'breeze'] },
  38: { friends: ['frog', 'ghost'], fields: ['portal'] },
  39: { friends: ['bear', 'star'], fields: ['split'] },
  40: { friends: ['pig', 'star', 'bunny'], fields: ['nom', 'jelly'], parMin: 9, parTarget: 9 }
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
  /* endless 41+ — one continuous, NEVER-regressing progression. The campaign
     finale (par 10) is the climax of its arc; the ladder then climbs 7 → 10
     across 41-50 and keeps stepping up forever: +1 par rung every 8 levels
     into marathon territory (par ~16 at L100, ~22 at L150, ~28 at L200, cap
     30), with walls, fields and friends growing alongside. Measured fact
     (parlab, 2026-06-12): long optimal lines live in SMALL state graphs when
     the board is a wall maze with a star tour - so marathon rungs always
     carry stars, and panda/chick (whose state space forces small boards that
     cap par) step off the ladder at those rungs. */
  const k = n - 41;
  base.w = base.h = k < 20 ? 6 : 7;
  base.parTarget = k < 9
    ? 7 + Math.floor(k / 3)
    : Math.min(30, 10 + Math.floor((k - 9) / 8));
  /* FLOOR-ONLY band: the floor is law, the ceiling breathes. Par disperses
     at high rungs (measured: rung 23 found only 26-34 candidates), so the
     acceptance window opens upward and 'exact' preference picks the
     candidate closest above the rung — never one below it. */
  base.parMin = base.parTarget;
  base.parMax = base.parTarget +
    (base.parTarget >= 18 ? 8 : base.parTarget >= 12 ? 3 : 2);
  base.parPrefer = 'exact';
  const marathon = base.parTarget >= 12;
  base.dots = 2;
  base.wallMax = Math.min(16, 7 + Math.floor(k / 6));
  /* generous attempts: rungs must hold without ever relaxing the floor.
     Marathon attempts stay cheap BY DESIGN: true marathon candidates live in
     small maze graphs, so a low state cap fails the sprawling non-maze
     sketches fast instead of burning the full search on boards that could
     never carry the rung (measured: this cuts deep-rung baking 3-5x). */
  base.attempts = k < 10 ? 200 : Math.min(320, 120 + k * 2);
  base.maxStates = base.parTarget >= 12 ? 50000 : 120000;
  /* the optimal line must use at least two featured groups — keeps
     on-device generation fast while boards stay busy */
  base.featureUseMin = 2;
  if (marathon) {
    base.starMax = Math.min(5, 3 + Math.floor((base.parTarget - 12) / 6));
  }
  /* panda/chick are swapped out on the visible 41-50 ladder AND on marathon
     rungs (board shrink caps par); 'star' is added explicitly on marathon
     rungs, so rotation picks skip it there to avoid duplicates */
  const skipHeavy = k < 10 || marathon;
  const pickFriend = (i: number): FriendKind => {
    let f = FRIEND_ROTATION[i % 10] as FriendKind;
    while ((skipHeavy && (f === 'panda' || f === 'chick')) || (marathon && f === 'star')) {
      i++;
      f = FRIEND_ROTATION[i % 10] as FriendKind;
    }
    return f;
  };
  /* the exclusion walk can collapse neighbours onto the same friend — walk
     the second pick forward until the pair is genuinely two friends */
  base.friends = [pickFriend(k)];
  let j = k * 3 + 1;
  let mate = pickFriend(j);
  while (mate === base.friends[0]) mate = pickFriend(++j);
  base.friends.push(mate);
  if (k >= 30) {
    /* the third slot always fills — walk the rotation past duplicates */
    let i = k * 7 + 5;
    let third = pickFriend(i);
    while (base.friends.includes(third)) third = pickFriend(++i);
    base.friends.push(third);
  }
  if (marathon) base.friends.unshift('star');
  /* panda/chick multiply the BFS state space — shrink the board for them
     (never reached on marathon rungs, where they are excluded) */
  if (base.friends.includes('panda') || base.friends.includes('chick')) {
    base.w = base.h = Math.max(5, base.w - 1);
    base.maxStates = Math.floor(base.maxStates / 2);
  }
  base.fields = [ENDLESS_FIELDS[(k * 7 + 3) % ENDLESS_FIELDS.length] as FieldKind];
  if (k >= 6) base.fields.push(ENDLESS_FIELDS[(k * 5 + 1) % ENDLESS_FIELDS.length] as FieldKind);
  if (k >= 45) base.fields.push(ENDLESS_FIELDS[(k * 11 + 4) % ENDLESS_FIELDS.length] as FieldKind);
  if (k % 3 === 1) base.classics = [(['box', 'balloon', 'snail'] as const)[k % 3] as ClassicKind];
  return base;
}

/** Debug baker: map a 1..10 hardness dial to generation params. The seed only
    rotates which friends/fields feature — hardness alone sets the par band,
    board size and mechanics load, so the dial is honest. */
export function bakeParams(hardness: number, seed: number): RampParams {
  const h = Math.max(1, Math.min(10, Math.round(hardness)));
  const parTarget = Math.min(12, 3 + h);
  const friendCount = h <= 1 ? 0 : h <= 4 ? 1 : h <= 7 ? 2 : 3;
  const friends: FriendKind[] = [];
  for (let i = 0; friends.length < friendCount && i < 10; i++) {
    const f = FRIEND_ROTATION[(seed * 3 + i * 7 + h) % 10] as FriendKind;
    if (!friends.includes(f)) friends.push(f);
  }
  const fieldCount = h <= 2 ? 0 : h <= 5 ? 1 : 2;
  const fields: FieldKind[] = [];
  for (let i = 0; fields.length < fieldCount && i < 10; i++) {
    const f = ENDLESS_FIELDS[(seed * 5 + i * 3 + h) % ENDLESS_FIELDS.length] as FieldKind;
    if (!fields.includes(f)) fields.push(f);
  }
  const p: RampParams = {
    w: h <= 3 ? 5 : h <= 7 ? 6 : 7,
    h: h <= 3 ? 5 : h <= 7 ? 6 : 7,
    /* capped from above: the scorer maximizes par, so the ceiling IS the
       dial — hardness 1 really bakes an easy board */
    parMin: Math.max(3, parTarget - 1),
    parTarget,
    parMax: parTarget,
    featureUseMin: Math.min(2, friendCount + fieldCount),
    dots: h <= 4 ? 1 : 2,
    friends,
    fields,
    classics: [],
    wallMax: 4 + Math.floor(h / 3),
    attempts: 150,
    maxStates: 250000
  };
  /* panda/chick multiply the BFS state space — shrink the board for them */
  if (friends.includes('panda') || friends.includes('chick')) {
    p.w = p.h = Math.max(5, p.w - 1);
    p.maxStates = Math.floor(p.maxStates / 2);
  }
  return p;
}
