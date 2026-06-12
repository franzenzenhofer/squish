/* Seeded board sketcher — proposes a random level for the solver to judge.
   Hard placement rules: pieces spawn on plain floor only, squishies never on
   the heart, every cell holds at most one thing. */
import type { LevelDef, XY, XYDir } from '../engine/types';
import type { FieldKind, RampParams } from './ramp';
import { pick, randInt, shuffle, type Rng } from './rng';

const DIR_CODES = ['U', 'D', 'L', 'R'] as const;

interface Slots {
  free: XY[];
  take: () => XY | undefined;
}

function makeSlots(rng: Rng, w: number, h: number): Slots {
  const free: XY[] = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) free.push([x, y]);
  shuffle(rng, free);
  return { free, take: () => free.pop() };
}

function fieldCellCount(rng: Rng, kind: FieldKind): number {
  if (kind === 'ice') return randInt(rng, 2, 4);
  if (kind === 'nom' || kind === 'portal') return 1;
  return randInt(rng, 1, 2);
}

export function sketch(rng: Rng, p: RampParams): LevelDef | null {
  const slots = makeSlots(rng, p.w, p.h);
  const target = slots.take();
  if (!target) return null;
  const def: LevelDef = { w: p.w, h: p.h, target, dots: [], par: 0 };

  /* walls — wallMin raises the density floor (boards must not feel empty) */
  const wallCount = randInt(rng, Math.min(p.wallMin ?? 2, p.wallMax), p.wallMax);
  const walls: XY[] = [];
  for (let i = 0; i < wallCount; i++) {
    const c = slots.take();
    if (c) walls.push(c);
  }
  if (walls.length > 0) def.walls = walls;

  const placeField = (kind: FieldKind): void => {
    if (kind === 'portal') {
      const a = slots.take();
      const b = slots.take();
      if (a && b) def.portals = [a, b];
      return;
    }
    const cells: XY[] = [];
    const count = fieldCellCount(rng, kind);
    for (let i = 0; i < count; i++) {
      const c = slots.take();
      if (c) cells.push(c);
    }
    if (cells.length === 0) return;
    if (kind === 'sticky') def.sticky = [...(def.sticky ?? []), ...cells];
    else if (kind === 'split') def.split = [...(def.split ?? []), ...cells];
    else if (kind === 'turn') def.turn = [...(def.turn ?? []), ...cells];
    else if (kind === 'ice') def.ice = [...(def.ice ?? []), ...cells];
    else if (kind === 'spring') def.spring = [...(def.spring ?? []), ...cells];
    else if (kind === 'jelly') def.jelly = [...(def.jelly ?? []), ...cells];
    else if (kind === 'nom') def.noms = [...(def.noms ?? []), ...cells];
    else if (kind === 'oneway') {
      def.oneway = [...(def.oneway ?? []), ...cells.map(
        (c): XYDir => [c[0], c[1], pick(rng, DIR_CODES)])];
    } else if (kind === 'breeze') {
      def.breeze = [...(def.breeze ?? []), ...cells.map(
        (c): XYDir => [c[0], c[1], pick(rng, DIR_CODES)])];
    }
  };

  /* featured fields (the optimal line must use them — see featuredOk) */
  const featured = new Set(p.fields);
  for (const kind of featured) placeField(kind);
  /* extras: already-introduced elements as living decoration — placed the
     same way but NEVER required by featuredOk, so intro levels stay focused
     on their new thing while boards read full */
  for (const kind of new Set(p.extras ?? [])) {
    if (kind === 'portal' || featured.has(kind)) continue;
    placeField(kind);
  }

  /* featured friends (1 piece each; stars are pickups, 1-2 of them) */
  for (const f of new Set(p.friends)) {
    if (f === 'star') {
      const n = randInt(rng, 1, Math.max(1, p.starMax ?? 2));
      const cells: XY[] = [];
      for (let i = 0; i < n; i++) {
        const c = slots.take();
        if (c) cells.push(c);
      }
      if (cells.length > 0) def.stars = cells;
      continue;
    }
    const c = slots.take();
    if (!c) return null;
    if (f === 'penguin') def.penguins = [c];
    else if (f === 'bunny') def.bunnies = [c];
    else if (f === 'frog') def.frogs = [c];
    else if (f === 'bear') def.bears = [c];
    else if (f === 'ghost') def.ghosts = [c];
    else if (f === 'pig') def.pigs = [c];
    else if (f === 'cat') def.cats = [c];
    else if (f === 'panda') def.pandas = [c];
    else if (f === 'chick') def.chicks = [c];
  }

  /* classic movers */
  for (const k of p.classics) {
    const c = slots.take();
    if (!c) continue;
    if (k === 'box') def.boxes = [...(def.boxes ?? []), c];
    else if (k === 'balloon') def.balloons = [...(def.balloons ?? []), c];
    else def.snails = [...(def.snails ?? []), c];
  }

  /* squishies last — plain floor, never the heart (slots guarantee both) */
  for (let i = 0; i < p.dots; i++) {
    const c = slots.take();
    if (!c) return null;
    def.dots.push(c);
  }
  return def;
}
