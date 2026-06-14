/* Tool icons — each builder tool painted ONCE by the real gameplay sprite/field
   painter (SSOT) into a small offscreen canvas, cached as a data URL and reused
   as an <img> in the palette and on every board cell. So an editor piece looks
   exactly like it does in play, by construction. */

import { SPR } from '../sprites';
import { FLD } from '../fields';
import { toolById, type ToolDef } from './tools';

const ICON_CSS = 30;
const ICON_SCALE = 2;
const cache = new Map<string, string>();

function paint(ctx: CanvasRenderingContext2D, tool: ToolDef): void {
  const r = tool.render;
  if (!r) return;
  const cell = ICON_CSS * 0.94;
  if (r.type === 'field') {
    const o = { px: ICON_CSS / 2, py: ICON_CSS / 2, cell, now: 0, gx: 0, gy: 0 };
    if (r.name === 'heart') {
      FLD.heart?.(ctx, { ...o, won: false, locked: false });
    } else {
      FLD[r.name]?.(ctx, o);
    }
    return;
  }
  SPR[r.name]?.(ctx, {
    x: ICON_CSS / 2, y: ICON_CSS * 0.6, cell, now: 0, idle: true, mood: 'happy', seed: 3
  });
}

/** Cached data URL of a tool's icon (empty string for the eraser / unknown). */
export function toolIcon(toolId: string): string {
  const hit = cache.get(toolId);
  if (hit !== undefined) return hit;
  const tool = toolById(toolId);
  if (!tool?.render) {
    cache.set(toolId, '');
    return '';
  }
  const c = document.createElement('canvas');
  c.width = c.height = ICON_CSS * ICON_SCALE;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.scale(ICON_SCALE, ICON_SCALE);
  paint(ctx, tool);
  const url = c.toDataURL();
  cache.set(toolId, url);
  return url;
}
