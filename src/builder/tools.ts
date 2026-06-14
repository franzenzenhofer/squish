/* Builder tool catalog (SSOT). Each tool maps to a LevelDef field and to how it
   is drawn (a gameplay sprite kind or a field graphic), so the palette, the
   board renderer, and toDef/fromDef all agree. v1 exposes only single-cell,
   direction-free elements (no oneway/breeze/portals) — the codec supports those
   but the editor does not place them yet, which keeps placement one-tap simple
   while staying fully lossless. */

import type { DirCode } from '../engine/types';

export type ToolKind = 'target' | 'dot' | 'paint' | 'eraser';
export type RenderType = 'sprite' | 'field';

export interface ToolDef {
  id: string;
  kind: ToolKind;
  /** LevelDef array field this paints into (omitted for target/dot/eraser). */
  field?: string;
  /** direction for the directional fields (oneway / breeze) — encodes XYDir */
  dir?: DirCode;
  /** at most this many may exist on a board (portals = exactly 2) */
  cap?: number;
  /** how to draw it on the board / palette */
  render?: { type: RenderType; name: string };
  label: string;
  /** carousel page (0-based) */
  page: number;
}

export const TOOLS: ToolDef[] = [
  { id: 'eraser', kind: 'eraser', label: 'Eraser', page: 0 },
  { id: 'heart', kind: 'target', render: { type: 'field', name: 'heart' }, label: 'Heart', page: 0 },
  { id: 'squishy', kind: 'dot', render: { type: 'sprite', name: 'squishy' }, label: 'Squishy', page: 0 },
  { id: 'wall', kind: 'paint', field: 'walls', render: { type: 'field', name: 'wall' }, label: 'Wall', page: 0 },
  { id: 'ice', kind: 'paint', field: 'ice', render: { type: 'field', name: 'ice' }, label: 'Ice', page: 0 },
  { id: 'jelly', kind: 'paint', field: 'jelly', render: { type: 'field', name: 'jelly' }, label: 'Jelly', page: 1 },
  { id: 'spring', kind: 'paint', field: 'spring', render: { type: 'field', name: 'spring' }, label: 'Spring', page: 1 },
  { id: 'star', kind: 'paint', field: 'stars', render: { type: 'sprite', name: 'star' }, label: 'Star', page: 1 },
  { id: 'box', kind: 'paint', field: 'boxes', render: { type: 'sprite', name: 'box' }, label: 'Box', page: 1 },
  { id: 'honey', kind: 'paint', field: 'sticky', render: { type: 'field', name: 'honey' }, label: 'Honey', page: 1 },
  { id: 'split', kind: 'paint', field: 'split', render: { type: 'field', name: 'sparkle' }, label: 'Split', page: 1 },
  { id: 'turn', kind: 'paint', field: 'turn', render: { type: 'field', name: 'turner' }, label: 'Turn', page: 1 },

  { id: 'balloon', kind: 'paint', field: 'balloons', render: { type: 'sprite', name: 'balloon' }, label: 'Balloon', page: 2 },
  { id: 'snail', kind: 'paint', field: 'snails', render: { type: 'sprite', name: 'snail' }, label: 'Snail', page: 2 },
  { id: 'frog', kind: 'paint', field: 'frogs', render: { type: 'sprite', name: 'frog' }, label: 'Frog', page: 2 },
  { id: 'bear', kind: 'paint', field: 'bears', render: { type: 'sprite', name: 'bear' }, label: 'Bear', page: 2 },
  { id: 'penguin', kind: 'paint', field: 'penguins', render: { type: 'sprite', name: 'penguin' }, label: 'Penguin', page: 2 },
  { id: 'bunny', kind: 'paint', field: 'bunnies', render: { type: 'sprite', name: 'bunny' }, label: 'Bunny', page: 2 },

  { id: 'cat', kind: 'paint', field: 'cats', render: { type: 'sprite', name: 'cat' }, label: 'Cat', page: 3 },
  { id: 'chick', kind: 'paint', field: 'chicks', render: { type: 'sprite', name: 'chick' }, label: 'Chick', page: 3 },
  { id: 'pig', kind: 'paint', field: 'pigs', render: { type: 'sprite', name: 'pig' }, label: 'Pig', page: 3 },
  { id: 'ghost', kind: 'paint', field: 'ghosts', render: { type: 'sprite', name: 'ghost' }, label: 'Ghost', page: 3 },
  { id: 'panda', kind: 'paint', field: 'pandas', render: { type: 'sprite', name: 'panda' }, label: 'Panda', page: 3 },

  /* the advanced directional bits come last, right before the nomster */
  { id: 'windU', kind: 'paint', field: 'breeze', dir: 'U', render: { type: 'field', name: 'pinwheel' }, label: 'Wind up', page: 3 },
  { id: 'windD', kind: 'paint', field: 'breeze', dir: 'D', render: { type: 'field', name: 'pinwheel' }, label: 'Wind down', page: 3 },
  { id: 'windL', kind: 'paint', field: 'breeze', dir: 'L', render: { type: 'field', name: 'pinwheel' }, label: 'Wind left', page: 3 },
  { id: 'windR', kind: 'paint', field: 'breeze', dir: 'R', render: { type: 'field', name: 'pinwheel' }, label: 'Wind right', page: 3 },
  { id: 'arrowU', kind: 'paint', field: 'oneway', dir: 'U', render: { type: 'field', name: 'oneway' }, label: 'One-way up', page: 3 },
  { id: 'arrowD', kind: 'paint', field: 'oneway', dir: 'D', render: { type: 'field', name: 'oneway' }, label: 'One-way down', page: 3 },
  { id: 'arrowL', kind: 'paint', field: 'oneway', dir: 'L', render: { type: 'field', name: 'oneway' }, label: 'One-way left', page: 3 },
  { id: 'arrowR', kind: 'paint', field: 'oneway', dir: 'R', render: { type: 'field', name: 'oneway' }, label: 'One-way right', page: 3 },
  { id: 'portal', kind: 'paint', field: 'portals', cap: 2, render: { type: 'field', name: 'portal' }, label: 'Portal', page: 3 },

  /* the nomster eats squishies — it lives last in the palette */
  { id: 'nom', kind: 'paint', field: 'noms', render: { type: 'sprite', name: 'nomster' }, label: 'Nomster', page: 3 }
];

const BY_ID: Record<string, ToolDef> = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
/* one tool per non-directional field (directional fields resolve via dir) */
const BY_FIELD: Record<string, ToolDef> = Object.fromEntries(
  TOOLS.filter((t) => t.field && !t.dir).map((t) => [t.field as string, t])
);
const BY_FIELD_DIR: Record<string, ToolDef> = Object.fromEntries(
  TOOLS.filter((t) => t.field && t.dir).map((t) => [t.field + ':' + t.dir, t])
);

export function toolById(id: string): ToolDef | undefined {
  return BY_ID[id];
}

/** The non-directional paint tool that owns a LevelDef field (for fromDef). */
export function toolByField(field: string): ToolDef | undefined {
  return BY_FIELD[field];
}

/** The directional tool for a field + DirCode (oneway / breeze, for fromDef). */
export function toolByFieldDir(field: string, dir: DirCode): ToolDef | undefined {
  return BY_FIELD_DIR[field + ':' + dir];
}

/** Every distinct LevelDef field the palette can place (for fromDef iteration). */
export const TOOL_FIELDS: string[] = [...new Set(TOOLS.filter((t) => t.field).map((t) => t.field as string))];

export const PAGES = Math.max(...TOOLS.map((t) => t.page)) + 1;
