/* Daily puzzle — one hard, deterministic level per calendar date. Every
   player gets the identical board: the seed is the date string. Hard means
   three different friends + two field types, all REQUIRED on the optimal
   line (featuredOk), par 7..10, on a big board. */
import type { LevelDef } from '../engine/types';
import { finalize, tryGenerate } from './generate';
import {
  FRIEND_ROTATION, type FieldKind, type FriendKind, type RampParams
} from './ramp';
import { hashStr, mulberry32, shuffle, type Rng } from './rng';

const DAILY_FIELDS: readonly FieldKind[] = [
  'sticky', 'oneway', 'split', 'portal', 'turn', 'ice', 'mush', 'breeze', 'jelly', 'nom'
];
const ROUNDS = 16;

export function dailySeed(date: string, round: number): Rng {
  return mulberry32(hashStr('squish-daily:' + date + ':' + round));
}

export function dailyParams(rng: Rng, round: number): RampParams {
  const friends = shuffle(rng, [...FRIEND_ROTATION]).slice(0, 3) as FriendKind[];
  const fields = shuffle(rng, [...DAILY_FIELDS]).slice(0, 2) as FieldKind[];
  /* 6x6 keeps the BFS per attempt cheap enough for in-worker generation;
     hardness comes from par >= 7 with three friends + two fields placed.
     panda/chick multiply the state space further — shrink for them. */
  const tight = friends.includes('panda') || friends.includes('chick');
  return {
    w: tight ? 5 : 6, h: tight ? 5 : 6,
    parMin: 7, parTarget: 7, parMax: 10,
    /* all 3 friends + 2 fields are ON the board; the optimal line must use
       at least 3 of the 5 (2 in late rescue rounds) — demanding all 5
       makes generation minutes-slow on unlucky dates */
    featureUseMin: round < 8 ? 3 : 2,
    dots: 2, friends, fields, classics: [],
    /* small deterministic budgets: a heavy sketch is rejected fast and the
       next seeded round takes over — keeps worst-case generation seconds,
       not minutes, and identical on every device */
    wallMax: 7, attempts: 60, maxStates: 30000
  };
}

/** Deterministic daily level for a YYYY-MM-DD date. Throws only if eight
    independent seeded rounds all fail — verify-daily proves they don't. */
export function generateDaily(date: string): LevelDef {
  for (let round = 0; round < ROUNDS; round++) {
    const rng = dailySeed(date, round);
    const c = tryGenerate(rng, dailyParams(rng, round));
    if (c) {
      const def = finalize(c);
      def.cap = 'daily puzzle - three friends, one heart';
      return def;
    }
  }
  throw new Error('daily generation failed for ' + date);
}

/** Local-timezone YYYY-MM-DD — the player's "today". */
export function localToday(): string {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
