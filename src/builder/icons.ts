/* Builder tool icons — resolve a tool to its gameplay sprite/field name and
   delegate to the ONE shared icon painter (src/game/spriteIcon). No drawing
   happens here: the editor and the level picker share the exact same SSOT
   painter, so a piece looks identical everywhere and there is no duplication. */

import { toolById } from './tools';
import { spriteIcon } from '../game/spriteIcon';

/** High-res data URL for a tool's icon (empty string for the eraser / unknown). */
export function toolIcon(toolId: string): string {
  const tool = toolById(toolId);
  if (!tool?.render) return '';
  return spriteIcon(tool.render.name, { kind: tool.render.type });
}
