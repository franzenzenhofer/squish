/* Registry of every sprite drawing function, keyed by sprite id. */
import type { SpriteFn } from '../lib/types';
import { squishy } from './squishy';
import { box } from './box';
import { balloon } from './balloon';
import { snail } from './snail';
import { nomster } from './nomster';
import { bear } from './friends/bear';
import { bunny } from './friends/bunny';
import { cat } from './friends/cat';
import { chick } from './friends/chick';
import { frog } from './friends/frog';
import { ghost } from './friends/ghost';
import { panda } from './friends/panda';
import { penguin } from './friends/penguin';
import { pig } from './friends/pig';
import { star } from './friends/star';

export const SPR: Record<string, SpriteFn> = {
  squishy,
  box,
  balloon,
  snail,
  nomster,
  bear,
  bunny,
  cat,
  chick,
  frog,
  ghost,
  panda,
  penguin,
  pig,
  star,
};
