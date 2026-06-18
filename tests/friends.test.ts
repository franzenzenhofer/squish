/* Behaviour tests for the ten friends — every rule hand-verified on tiny boards. */
import { describe, expect, it } from 'vitest';
import { cloneState, isWin, key, makeLevel, ser } from '../src/engine/core';
import { move } from '../src/engine/move';
import { solve } from '../src/engine/solve';
import type { Dir, GameState, Level, LevelDef } from '../src/engine/types';

function lvl(partial: Partial<LevelDef> & Pick<LevelDef, 'w' | 'h' | 'target'>): Level {
  return makeLevel({ dots: [], par: 1, ...partial });
}

function run(level: Level, dirs: Dir[], from?: GameState): GameState {
  let st = cloneState(from ?? level.initState);
  for (const d of dirs) st = move(level, st, d).state;
  return st;
}

describe('penguin', () => {
  it('glides over thin ice without cracking it', () => {
    const L = lvl({ w: 5, h: 1, target: [0, 0], penguins: [[0, 0]], ice: [[1, 0], [2, 0]], walls: [[4, 0]] });
    const st = run(L, ['right']);
    expect(st.penguins).toEqual([{ x: 3, y: 0 }]);
    expect(st.broken.size).toBe(0);
  });
  it('a box on the same path shatters the ice', () => {
    const L = lvl({ w: 5, h: 1, target: [0, 0], boxes: [[0, 0]], ice: [[1, 0], [2, 0]], walls: [[4, 0]] });
    const st = run(L, ['right']);
    expect(st.boxes).toEqual([{ x: 3, y: 0 }]);
    expect(st.broken.has(key(1, 0))).toBe(true);
    expect(st.broken.has(key(2, 0))).toBe(true);
  });
});

describe('bear', () => {
  it('plods exactly two steps', () => {
    const L = lvl({ w: 5, h: 1, target: [0, 0], bears: [[0, 0]] });
    expect(run(L, ['right']).bears).toEqual([{ x: 2, y: 0 }]);
  });
  it('scares a nomster away and survives', () => {
    const L = lvl({ w: 5, h: 1, target: [0, 0], bears: [[0, 0]], noms: [[1, 0]] });
    const r = move(L, cloneState(L.initState), 'right');
    expect(r.state.bears).toEqual([{ x: 0, y: 0 }]);
    expect(r.state.fed.has(key(1, 0))).toBe(true);
    expect(r.movers.some((m) => m.fx.some((f) => f.type === 'scare'))).toBe(true);
  });
});

describe('ghostie', () => {
  it('floats through walls and stops at the edge', () => {
    const L = lvl({ w: 5, h: 1, target: [0, 0], ghosts: [[0, 0]], walls: [[1, 0], [2, 0]] });
    expect(run(L, ['right']).ghosts).toEqual([{ x: 4, y: 0 }]);
  });
  it('is stopped by another piece (the box has not moved yet, so it is solid)', () => {
    const L = lvl({ w: 5, h: 1, target: [0, 0], ghosts: [[0, 0]], walls: [[1, 0]], boxes: [[3, 0]] });
    const st = run(L, ['right']);
    expect(st.ghosts).toEqual([{ x: 2, y: 0 }]);
    expect(st.boxes).toEqual([{ x: 4, y: 0 }]);
  });
  it('ignores honey and nomsters', () => {
    const L = lvl({ w: 5, h: 1, target: [0, 0], ghosts: [[0, 0]], sticky: [[1, 0]], noms: [[2, 0]] });
    const st = run(L, ['right']);
    expect(st.ghosts).toEqual([{ x: 4, y: 0 }]);
    expect(st.fed.size).toBe(0);
  });
});

describe('bunny', () => {
  it('hops exactly two squares, right over a wall in between', () => {
    const L = lvl({ w: 6, h: 1, target: [0, 0], bunnies: [[0, 0]], walls: [[1, 0]] });
    expect(run(L, ['right']).bunnies).toEqual([{ x: 2, y: 0 }]);
  });
  it('falls back to one square when the far cell is blocked', () => {
    const L = lvl({ w: 6, h: 1, target: [0, 0], bunnies: [[0, 0]], walls: [[2, 0]] });
    expect(run(L, ['right']).bunnies).toEqual([{ x: 1, y: 0 }]);
  });
  it('stays put when neither two nor one square lands', () => {
    const L = lvl({ w: 6, h: 1, target: [0, 0], bunnies: [[0, 0]], walls: [[1, 0], [2, 0]] });
    expect(run(L, ['right']).bunnies).toEqual([{ x: 0, y: 0 }]);
  });
  it('hops one square into the last cell at the edge', () => {
    const L = lvl({ w: 2, h: 1, target: [0, 0], bunnies: [[0, 0]] });
    expect(run(L, ['right']).bunnies).toEqual([{ x: 1, y: 0 }]);
  });
  it('is eaten only when it lands on a nomster, not hopping over one', () => {
    const over = lvl({ w: 6, h: 1, target: [0, 0], bunnies: [[0, 0]], noms: [[1, 0]] });
    expect(run(over, ['right']).bunnies).toEqual([{ x: 2, y: 0 }]);
    const land = lvl({ w: 6, h: 1, target: [0, 0], bunnies: [[0, 0]], noms: [[2, 0]] });
    expect(run(land, ['right']).bunnies).toEqual([]);
  });
});

describe('star', () => {
  it('heart only opens when every star is collected', () => {
    const L = lvl({ w: 5, h: 1, target: [4, 0], dots: [[0, 0]], stars: [[2, 0]] });
    const st = run(L, ['right']);
    expect(st.stars.size).toBe(0);
    expect(isWin(L, st)).toBe(true);
  });
  it('resting on the heart with a star left is not a win', () => {
    const L = lvl({ w: 5, h: 2, target: [4, 0], dots: [[0, 0]], stars: [[2, 1]] });
    const st = run(L, ['right']);
    expect(st.dots).toEqual([{ x: 4, y: 0, m: 1 }]);
    expect(isWin(L, st)).toBe(false);
  });
});

describe('froggy', () => {
  it('leaps over everything and lands just before the first blocker', () => {
    const L = lvl({ w: 6, h: 1, target: [0, 0], frogs: [[0, 0]], sticky: [[1, 0]], noms: [[2, 0]], walls: [[4, 0]] });
    const st = run(L, ['right']);
    expect(st.frogs).toEqual([{ x: 3, y: 0 }]);
    expect(st.fed.size).toBe(0);
  });
  it('cannot move when directly blocked', () => {
    const L = lvl({ w: 6, h: 1, target: [0, 0], frogs: [[0, 0]], walls: [[1, 0]] });
    expect(run(L, ['right']).frogs).toEqual([{ x: 0, y: 0 }]);
  });
});

describe('panda', () => {
  it('sleeps on the first swipe and moves on the second', () => {
    const L = lvl({ w: 5, h: 2, target: [0, 0], dots: [[0, 1]], pandas: [[1, 0]] });
    const s1 = run(L, ['right']);
    expect(s1.pandas).toEqual([{ x: 1, y: 0 }]);
    expect(s1.parity).toBe(1);
    const s2 = run(L, ['right', 'right']);
    expect(s2.pandas).toEqual([{ x: 4, y: 0 }]);
    expect(s2.parity).toBe(0);
  });
});

describe('kitty', () => {
  it('turns clockwise once at a wall and keeps going', () => {
    const L = lvl({ w: 5, h: 5, target: [0, 0], cats: [[0, 0]], walls: [[3, 0]] });
    expect(run(L, ['right']).cats).toEqual([{ x: 2, y: 4 }]);
  });
  it('only turns once per swipe', () => {
    const L = lvl({ w: 5, h: 3, target: [0, 0], cats: [[0, 0]], walls: [[3, 0]] });
    expect(run(L, ['right']).cats).toEqual([{ x: 2, y: 2 }]);
  });
});

describe('chick', () => {
  it('stays put on the first swipe, then copies the previous direction', () => {
    const L = lvl({ w: 5, h: 5, target: [0, 4], dots: [[0, 1]], chicks: [[0, 0]] });
    const s1 = run(L, ['right']);
    expect(s1.chicks).toEqual([{ x: 0, y: 0 }]);
    expect(s1.lastDir).toBe('right');
    const s2 = run(L, ['right', 'down']);
    expect(s2.chicks).toEqual([{ x: 4, y: 0 }]);
    expect(s2.dots).toEqual([{ x: 4, y: 4, m: 1 }]);
    expect(s2.lastDir).toBe('down');
  });
  it('moves before Squishy, so Squishy can be blocked by where the chick lands', () => {
    const L = lvl({ w: 5, h: 5, target: [0, 0], dots: [[3, 4]], chicks: [[0, 0]] });
    const st = run(L, ['right', 'up']);
    expect(st.chicks).toEqual([{ x: 4, y: 0 }]);
    expect(st.dots).toEqual([{ x: 4, y: 1, m: 1 }]);
  });
});

describe('move order', () => {
  it('runs slow movers first and Squishy last, treating unmoved pieces as solid', () => {
    /* the snail moves first but is penned in by a Squishy that has not moved
       yet; then Squishy slides last, all the way to the edge */
    const L = lvl({ w: 5, h: 1, target: [4, 0], snails: [[0, 0]], dots: [[1, 0]] });
    const st = run(L, ['right']);
    expect(st.snails).toEqual([{ x: 0, y: 0 }]);
    expect(st.dots).toEqual([{ x: 4, y: 0, m: 1 }]);
  });
});

describe('piggy', () => {
  it('scoots one square when bumped; the pusher takes her old cell', () => {
    const L = lvl({ w: 5, h: 1, target: [0, 0], dots: [[0, 0]], pigs: [[2, 0]] });
    const st = run(L, ['right']);
    expect(st.pigs).toEqual([{ x: 3, y: 0 }]);
    expect(st.dots).toEqual([{ x: 2, y: 0, m: 1 }]);
  });
  it('is shoved at most once per swipe (two pushers)', () => {
    const L = lvl({ w: 6, h: 1, target: [0, 0], boxes: [[0, 0], [1, 0]], pigs: [[3, 0]] });
    const st = run(L, ['right']);
    expect(st.pigs).toEqual([{ x: 4, y: 0 }]);
    const xs = st.boxes.map((b) => b.x).sort((a, b) => a - b);
    expect(xs).toEqual([2, 3]);
  });
  it('shoved into a nomster she feeds it', () => {
    const L = lvl({ w: 5, h: 1, target: [0, 0], dots: [[0, 0]], pigs: [[2, 0]], noms: [[3, 0]] });
    const st = run(L, ['right']);
    expect(st.pigs).toEqual([]);
    expect(st.fed.has(key(3, 0))).toBe(true);
    expect(st.dots).toEqual([{ x: 2, y: 0, m: 1 }]);
  });
  it('leaving intact ice shatters it and blocks the pusher', () => {
    const L = lvl({ w: 5, h: 1, target: [0, 0], dots: [[0, 0]], pigs: [[2, 0]], ice: [[2, 0]] });
    const st = run(L, ['right']);
    expect(st.pigs).toEqual([{ x: 3, y: 0 }]);
    expect(st.broken.has(key(2, 0))).toBe(true);
    expect(st.dots).toEqual([{ x: 1, y: 0, m: 1 }]);
  });
  it('shoving a pig off the heart lets the pusher win', () => {
    const L = lvl({ w: 5, h: 1, target: [2, 0], dots: [[0, 0]], pigs: [[2, 0]] });
    const st = run(L, ['right']);
    expect(isWin(L, st)).toBe(true);
  });
  it('cannot be shoved into a wall, another pig, or against a one-way', () => {
    const wall = lvl({ w: 5, h: 1, target: [0, 0], dots: [[0, 0]], pigs: [[2, 0]], walls: [[3, 0]] });
    const s1 = run(wall, ['right']);
    expect(s1.pigs).toEqual([{ x: 2, y: 0 }]);
    expect(s1.dots).toEqual([{ x: 1, y: 0, m: 1 }]);
    const two = lvl({ w: 5, h: 1, target: [0, 0], dots: [[0, 0]], pigs: [[2, 0], [3, 0]] });
    const s2 = run(two, ['right']);
    expect(s2.pigs.map((p) => p.x).sort((a, b) => a - b)).toEqual([2, 3]);
    const ow = lvl({ w: 5, h: 1, target: [0, 0], dots: [[0, 0]], pigs: [[2, 0]], oneway: [[3, 0, 'L']] });
    const s3 = run(ow, ['right']);
    expect(s3.pigs).toEqual([{ x: 2, y: 0 }]);
  });
});

describe('state serialization', () => {
  it('parity and lastDir are part of the state identity', () => {
    const L = lvl({ w: 5, h: 2, target: [0, 0], dots: [[0, 1]], pandas: [[4, 0]] });
    const base = cloneState(L.initState);
    const flipped = cloneState(L.initState);
    flipped.parity = 1;
    const turned = cloneState(L.initState);
    turned.lastDir = 'up';
    expect(ser(flipped)).not.toBe(ser(base));
    expect(ser(turned)).not.toBe(ser(base));
  });
});

describe('tri-state solver', () => {
  it('reports definitively unsolvable when no move exists', () => {
    const L = lvl({ w: 3, h: 3, target: [2, 2], dots: [[0, 0]], walls: [[1, 0], [0, 1]] });
    expect(solve(L).status).toBe('unsolvable');
  });
  it('reports unknown when the depth budget is too small', () => {
    const L = lvl({ w: 5, h: 5, target: [4, 4], dots: [[0, 0]], par: 2 });
    const full = solve(L);
    expect(full.status).toBe('solved');
    if (full.status === 'solved') {
      expect(full.par).toBe(2);
      const starved = solve(L, { maxDepth: full.par - 1 });
      expect(starved.status).toBe('unknown');
    }
  });
});
