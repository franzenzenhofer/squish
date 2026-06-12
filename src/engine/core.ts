/* Engine core — directions, level parsing, state plumbing. Pure logic. */
import type {
  Dir, DirCode, DotPt, GameState, Level, LevelDef, Pt, XY, XYDir
} from './types';

export const DIRS: Record<Dir, readonly [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]
};
export const DIRNAMES: readonly Dir[] = ['up', 'down', 'left', 'right'];
export const DIRCODE: Record<Dir, DirCode> = { up: 'U', down: 'D', left: 'L', right: 'R' };
export const CODEDIR: Record<DirCode, Dir> = { U: 'up', D: 'down', L: 'left', R: 'right' };
export const ROTCW: Record<Dir, Dir> = { up: 'right', right: 'down', down: 'left', left: 'up' };
export const REV: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function key(x: number, y: number): string {
  return x + ',' + y;
}

function toSet(arr?: XY[]): Set<string> {
  return new Set((arr ?? []).map((p) => key(p[0], p[1])));
}

function toPts(arr?: XY[]): Pt[] {
  return (arr ?? []).map((p) => ({ x: p[0], y: p[1] }));
}

function toDirMap(arr?: XYDir[]): Map<string, Dir> {
  const m = new Map<string, Dir>();
  for (const a of arr ?? []) m.set(key(a[0], a[1]), CODEDIR[a[2]]);
  return m;
}

export function makeLevel(o: LevelDef): Level {
  const portal = new Map<string, Pt>();
  if (o.portals && o.portals.length === 2) {
    const [a, b] = o.portals;
    portal.set(key(a[0], a[1]), { x: b[0], y: b[1] });
    portal.set(key(b[0], b[1]), { x: a[0], y: a[1] });
  }
  return {
    w: o.w,
    h: o.h,
    walls: toSet(o.walls),
    noms: toSet(o.noms),
    sticky: toSet(o.sticky),
    split: toSet(o.split),
    turn: toSet(o.turn),
    ice: toSet(o.ice),
    jelly: toSet(o.jelly),
    spring: toSet(o.spring),
    oneway: toDirMap(o.oneway),
    breeze: toDirMap(o.breeze),
    portal,
    target: key(o.target[0], o.target[1]),
    tx: o.target[0],
    ty: o.target[1],
    par: o.par,
    initState: {
      dots: (o.dots ?? []).map((p) => ({ x: p[0], y: p[1], m: 1 })),
      boxes: toPts(o.boxes),
      balloons: toPts(o.balloons),
      snails: toPts(o.snails),
      penguins: toPts(o.penguins),
      bears: toPts(o.bears),
      ghosts: toPts(o.ghosts),
      bunnies: toPts(o.bunnies),
      frogs: toPts(o.frogs),
      pandas: toPts(o.pandas),
      cats: toPts(o.cats),
      chicks: toPts(o.chicks),
      pigs: toPts(o.pigs),
      broken: new Set<string>(),
      fed: new Set<string>(),
      stars: toSet(o.stars),
      parity: 0,
      lastDir: null
    }
  };
}

function cpPts(a: Pt[]): Pt[] {
  return a.map((p) => ({ x: p.x, y: p.y }));
}

export function cloneState(st: GameState): GameState {
  return {
    dots: st.dots.map((p): DotPt => ({ x: p.x, y: p.y, m: p.m })),
    boxes: cpPts(st.boxes),
    balloons: cpPts(st.balloons),
    snails: cpPts(st.snails),
    penguins: cpPts(st.penguins),
    bears: cpPts(st.bears),
    ghosts: cpPts(st.ghosts),
    bunnies: cpPts(st.bunnies),
    frogs: cpPts(st.frogs),
    pandas: cpPts(st.pandas),
    cats: cpPts(st.cats),
    chicks: cpPts(st.chicks),
    pigs: cpPts(st.pigs),
    broken: new Set(st.broken),
    fed: new Set(st.fed),
    stars: new Set(st.stars),
    parity: st.parity,
    lastDir: st.lastDir
  };
}

/** Win: exactly one squishy resting on the heart, all stars collected. */
export function isWin(level: Level, state: GameState): boolean {
  const d = state.dots[0];
  return state.dots.length === 1 && d !== undefined &&
    key(d.x, d.y) === level.target && state.stars.size === 0;
}

function j(a: Pt[]): string {
  return a.map((p) => key(p.x, p.y)).sort().join('|');
}

/** Canonical state string for BFS dedup (dot mass is cosmetic — excluded). */
export function ser(state: GameState): string {
  return [
    j(state.dots), j(state.boxes), j(state.balloons), j(state.snails),
    j(state.penguins), j(state.bears), j(state.ghosts), j(state.bunnies),
    j(state.frogs), j(state.pandas), j(state.cats), j(state.chicks), j(state.pigs),
    Array.from(state.broken).sort().join('|'),
    Array.from(state.fed).sort().join('|'),
    Array.from(state.stars).sort().join('|'),
    String(state.parity),
    state.lastDir ?? '·'
  ].join('#');
}
