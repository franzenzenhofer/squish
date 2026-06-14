/* Builder tool icons — resolve a tool to its gameplay sprite/field name and
   delegate to the ONE shared icon painter (src/game/spriteIcon). No drawing
   happens here: the editor and the level picker share the exact same SSOT
   painter, so a piece looks identical everywhere and there is no duplication. */

import { toolById } from './tools';
import { spriteIcon } from '../game/spriteIcon';
import { CODEDIR } from '../engine/core';

/** High-res data URL for a tool's icon (empty string for the eraser / unknown).
    Directional tools (winds / arrows) pass their direction so the icon points the
    right way and the four variants are visually distinct in the palette. */
export function toolIcon(toolId: string): string {
  const tool = toolById(toolId);
  if (!tool?.render) return '';
  return spriteIcon(tool.render.name, { kind: tool.render.type, dir: tool.dir ? CODEDIR[tool.dir] : undefined });
}
