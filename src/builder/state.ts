/* Builder state machine — pure, DOM-free, the single source of truth for what
   is on the editor board. Invariants: the heart (target) is unique and
   relocates; squishies (dots) may be many; at most ONE element occupies a cell
   (so the share codec stays lossless). toDef/fromDef bridge to LevelDef. */

import type { LevelDef, XY } from '../engine/types';
import { toolById, toolByField, TOOLS } from './tools';

export interface BuilderState {
  w: number;
  h: number;
  target: XY | null;
  dots: XY[];
  /** cell key "x,y" -> paint tool id (walls, stars, friends, fields...) */
  cells: Map<string, string>;
  active: string;
}

const key = (x: number, y: number): string => x + ',' + y;
const inBounds = (s: BuilderState, x: number, y: number): boolean =>
  x >= 0 && x < s.w && y >= 0 && y < s.h;

export function createBuilderState(w: number, h: number, active = 'squishy'): BuilderState {
  return { w, h, target: null, dots: [], cells: new Map(), active };
}

export function selectTool(s: BuilderState, id: string): void {
  if (!toolById(id)) throw new Error('unknown tool ' + id);
  s.active = id;
}

export function dotCount(s: BuilderState): number {
  return s.dots.length;
}

/** Remove whatever occupies a cell (heart, a squishy, or a paint tool). */
function clearCell(s: BuilderState, x: number, y: number): void {
  if (s.target && s.target[0] === x && s.target[1] === y) s.target = null;
  s.dots = s.dots.filter((d) => d[0] !== x || d[1] !== y);
  s.cells.delete(key(x, y));
}

export function eraseAt(s: BuilderState, x: number, y: number): void {
  if (!inBounds(s, x, y)) return;
  clearCell(s, x, y);
}

/** Apply the active tool at a cell. */
export function placeAt(s: BuilderState, x: number, y: number): void {
  if (!inBounds(s, x, y)) return;
  const tool = toolById(s.active);
  if (!tool) return;
  if (tool.kind === 'eraser') {
    clearCell(s, x, y);
    return;
  }
  clearCell(s, x, y); // one element per cell
  if (tool.kind === 'target') {
    s.target = [x, y]; // unique: any prior heart is dropped below
    return;
  }
  if (tool.kind === 'dot') {
    s.dots.push([x, y]);
    return;
  }
  s.cells.set(key(x, y), tool.id);
}

export function resize(s: BuilderState, w: number, h: number): void {
  s.w = w;
  s.h = h;
  if (s.target && !inBounds(s, s.target[0], s.target[1])) s.target = null;
  s.dots = s.dots.filter((d) => inBounds(s, d[0], d[1]));
  for (const k of [...s.cells.keys()]) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    if (!inBounds(s, x, y)) s.cells.delete(k);
  }
}

export function clearBoard(s: BuilderState): void {
  s.target = null;
  s.dots = [];
  s.cells.clear();
}

/** Build a LevelDef from the board (par filled by the solver later). */
export function toDef(s: BuilderState): LevelDef {
  const def: LevelDef = {
    w: s.w, h: s.h,
    target: s.target ?? [0, 0],
    dots: s.dots.map((d) => [d[0], d[1]]),
    par: 0
  };
  for (const [k, toolId] of s.cells) {
    const tool = toolById(toolId);
    if (!tool?.field) continue;
    const [x, y] = k.split(',').map(Number) as [number, number];
    const arr = ((def as unknown as Record<string, XY[]>)[tool.field] ??= []);
    arr.push([x, y]);
  }
  return def;
}

/** Load a LevelDef into a fresh builder state. */
export function fromDef(def: LevelDef): BuilderState {
  const s = createBuilderState(def.w, def.h);
  s.target = [def.target[0], def.target[1]];
  s.dots = def.dots.map((d) => [d[0], d[1]]);
  for (const tool of TOOLS) {
    if (!tool.field) continue;
    const cells = (def as unknown as Record<string, XY[] | undefined>)[tool.field];
    if (!Array.isArray(cells)) continue;
    for (const [x, y] of cells) {
      const owner = toolByField(tool.field);
      if (owner) s.cells.set(key(x, y), owner.id);
    }
  }
  return s;
}
