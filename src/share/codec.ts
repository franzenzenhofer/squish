/* Level share codec — pure, lossless, human-readable.

   Code shape:  level-<v>-<w>x<h>-<glyphs>.<crc36>
   One glyph per cell, row-major (left-to-right, top-to-bottom). Directional
   cells (oneway/breeze) are a 2-char token: an uppercase base + a lowercase
   direction suffix. `par` is NOT encoded — it is recomputed by solve() on
   import. Losslessness relies on the editor invariant of at most one element
   per cell (verified across all 50 curated levels). */

import type { LevelDef, XY, XYDir, DirCode } from '../engine/types';
import { crc32Base36 } from './crc32';
import {
  CELL_GLYPH, GLYPH_CELL, DIR_BASE, BASE_DIR, DIR_SUFFIX, SUFFIX_DIR, EMPTY
} from './glyphs';

export const VERSION = 1;

export class CodecError extends Error {}

/** XY[] fields that map straight to a single glyph via CELL_GLYPH. */
const ARRAY_FIELDS = [
  'dots', 'walls', 'noms', 'sticky', 'split', 'turn', 'ice', 'jelly', 'spring',
  'boxes', 'balloons', 'snails', 'penguins', 'bears', 'ghosts', 'bunnies',
  'frogs', 'pandas', 'cats', 'chicks', 'pigs', 'stars'
] as const;

const ck = (x: number, y: number): string => x + ',' + y;

/** Build the cell -> token map. Throws on two elements sharing a cell. */
function cellMap(def: LevelDef): Map<string, string> {
  const m = new Map<string, string>();
  const set = (x: number, y: number, token: string): void => {
    const key = ck(x, y);
    if (m.has(key)) throw new CodecError('two elements on cell ' + key);
    m.set(key, token);
  };
  set(def.target[0], def.target[1], CELL_GLYPH.target as string);
  for (const field of ARRAY_FIELDS) {
    const cells = def[field] as XY[] | undefined;
    if (!cells) continue;
    const g = CELL_GLYPH[field] as string;
    for (const [x, y] of cells) set(x, y, g);
  }
  if (def.portals) {
    const [pa, pb] = def.portals;
    set(pa[0], pa[1], CELL_GLYPH.portalA as string);
    set(pb[0], pb[1], CELL_GLYPH.portalB as string);
  }
  for (const field of ['oneway', 'breeze'] as const) {
    const cells = def[field] as XYDir[] | undefined;
    if (!cells) continue;
    const base = DIR_BASE[field] as string;
    for (const [x, y, dir] of cells) set(x, y, base + (DIR_SUFFIX[dir] as string));
  }
  return m;
}

export function encode(def: LevelDef): string {
  const map = cellMap(def);
  let glyphs = '';
  for (let y = 0; y < def.h; y++) {
    for (let x = 0; x < def.w; x++) glyphs += map.get(ck(x, y)) ?? EMPTY;
  }
  const head = VERSION + '-' + def.w + 'x' + def.h;
  const crc = crc32Base36(head + '|' + glyphs);
  return 'level-' + head + '-' + glyphs + '.' + crc;
}

const HEAD_RE = /^level-(\d+)-(\d+)x(\d+)-([A-Za-z0-9]*)\.([0-9a-z]+)$/;

export function decode(code: string): LevelDef {
  const mraw = HEAD_RE.exec(code);
  if (!mraw) throw new CodecError('malformed share code');
  const v = Number(mraw[1]);
  if (v !== VERSION) throw new CodecError('unsupported version ' + v);
  const w = Number(mraw[2]);
  const h = Number(mraw[3]);
  const glyphs = mraw[4] as string;
  const crc = mraw[5] as string;
  if (crc32Base36(v + '-' + w + 'x' + h + '|' + glyphs) !== crc) {
    throw new CodecError('checksum mismatch — link corrupted');
  }
  return buildDef(glyphs, w, h);
}

function buildDef(glyphs: string, w: number, h: number): LevelDef {
  const def: LevelDef = { w, h, target: [0, 0], dots: [], par: 0 };
  const push = (field: string, v: XY | XYDir): void => {
    const arr = (def[field as keyof LevelDef] as unknown[]) ?? [];
    arr.push(v);
    (def as unknown as Record<string, unknown>)[field] = arr;
  };
  let portalA: XY | null = null;
  let portalB: XY | null = null;
  let cur = 0;
  for (let cell = 0; cell < w * h; cell++) {
    const x = cell % w;
    const y = Math.floor(cell / w);
    const g = glyphs[cur++];
    if (g === undefined) throw new CodecError('glyph stream too short');
    if (g === EMPTY) continue;
    const dirField = BASE_DIR[g];
    if (dirField) {
      const suf = glyphs[cur++];
      const dir = suf === undefined ? undefined : SUFFIX_DIR[suf];
      if (!dir) throw new CodecError('bad direction suffix at cell ' + cell);
      push(dirField, [x, y, dir as DirCode]);
      continue;
    }
    const field = GLYPH_CELL[g];
    if (!field) throw new CodecError('unknown glyph "' + g + '"');
    if (field === 'target') def.target = [x, y];
    else if (field === 'portalA') portalA = [x, y];
    else if (field === 'portalB') portalB = [x, y];
    else push(field, [x, y]);
  }
  if (cur !== glyphs.length) throw new CodecError('glyph stream too long');
  if (portalA && portalB) def.portals = [portalA, portalB];
  return def;
}

/** Geometry-only equality (ignores par/sol/cap; order-independent). */
export function geometryEqual(a: LevelDef, b: LevelDef): boolean {
  if (a.w !== b.w || a.h !== b.h) return false;
  const ma = cellMap(a);
  const mb = cellMap(b);
  if (ma.size !== mb.size) return false;
  for (const [k, v] of ma) if (mb.get(k) !== v) return false;
  return true;
}
