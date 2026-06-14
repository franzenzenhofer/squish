/* Builder state machine — pure, DOM-free, the single source of truth for what
   is on the editor board. Invariants: the heart (target) is unique and
   relocates; squishies (dots) may be many; at most ONE element occupies a cell
   (so the share codec stays lossless). toDef/fromDef bridge to LevelDef. */

import type { LevelDef, XY, XYDir, DirCode } from '../engine/types';
import { toolById, toolByField, toolByFieldDir, TOOL_FIELDS } from './tools';

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

/** The tool id occupying a cell (heart/squishy/paint id), or null if empty. */
export function pieceAt(s: BuilderState, x: number, y: number): string | null {
  if (s.target && s.target[0] === x && s.target[1] === y) return 'heart';
  if (s.dots.some((d) => d[0] === x && d[1] === y)) return 'squishy';
  return s.cells.get(key(x, y)) ?? null;
}

/** Place a SPECIFIC tool at a cell without changing the active tool (used when
    dragging an existing piece to a new cell). */
export function applyToolAt(s: BuilderState, toolId: string, x: number, y: number): void {
  const prev = s.active;
  s.active = toolId;
  placeAt(s, x, y);
  s.active = prev;
}

/** How many cells currently hold a given paint-tool id (for capped tools). */
export function countTool(s: BuilderState, id: string): number {
  let n = 0;
  for (const v of s.cells.values()) if (v === id) n++;
  return n;
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
  /* capped tools (portals = 2): refuse a NEW cell once the cap is reached */
  if (tool.cap && pieceAt(s, x, y) !== tool.id && countTool(s, tool.id) >= tool.cap) return;
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
  const portalCells: XY[] = [];
  for (const [k, toolId] of s.cells) {
    const tool = toolById(toolId);
    if (!tool?.field) continue;
    const [x, y] = k.split(',').map(Number) as [number, number];
    if (tool.field === 'portals') { portalCells.push([x, y]); continue; }
    const d = def as unknown as Record<string, (XY | XYDir)[]>;
    (d[tool.field] ??= []).push(tool.dir ? [x, y, tool.dir] : [x, y]);
  }
  /* portals are a LINKED PAIR — emitted only when exactly two are placed */
  const [pa, pb] = portalCells;
  if (pa && pb) def.portals = [pa, pb];
  return def;
}

/** Load a LevelDef into a fresh builder state. */
export function fromDef(def: LevelDef): BuilderState {
  const s = createBuilderState(def.w, def.h);
  s.target = [def.target[0], def.target[1]];
  s.dots = def.dots.map((d) => [d[0], d[1]]);
  for (const field of TOOL_FIELDS) {
    const cells = (def as unknown as Record<string, (XY | XYDir)[] | undefined>)[field];
    if (!Array.isArray(cells)) continue;
    if (field === 'portals') { // a linked pair -> two portal cells
      for (const c of cells) s.cells.set(key(c[0], c[1]), 'portal');
      continue;
    }
    for (const c of cells) {
      const dir = c.length >= 3 ? (c[2] as DirCode) : undefined;
      const owner = dir ? toolByFieldDir(field, dir) : toolByField(field);
      if (owner) s.cells.set(key(c[0], c[1]), owner.id);
    }
  }
  return s;
}
