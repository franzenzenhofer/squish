/* Registry of every field drawing function, keyed by field id. */
import type { FieldFn } from '../lib/types';
import { heart } from './heart';
import { honey } from './honey';
import { ice } from './ice';
import { jelly } from './jelly';
import { mushroom } from './mushroom';
import { oneway } from './oneway';
import { pinwheel } from './pinwheel';
import { portal } from './portal';
import { shards } from './shards';
import { sparkle } from './sparkle';
import { turner } from './turner';
import { wall } from './wall';

export const FLD: Record<string, FieldFn> = {
  heart,
  honey,
  ice,
  jelly,
  mushroom,
  oneway,
  pinwheel,
  portal,
  shards,
  sparkle,
  turner,
  wall,
};
