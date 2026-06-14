/* Builder DOM builders — size chips, the empty-cell tile backdrop (a CSS grid
   behind the game-rendered canvas), and the paged tool palette with a real
   scroll-driven page indicator and drag-to-board start. No board renderer lives
   here: the board is the game's own canvas (see render.ts). */

import { TOOLS, PAGES, type ToolDef } from './tools';
import { toolIcon } from './icons';

const el = (tag: string, cls?: string): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
};

export const SIZES = [3, 4, 5, 6, 7];

export function buildChips(host: HTMLElement, onPick: (n: number) => void): void {
  host.textContent = '';
  for (const n of SIZES) {
    const b = el('button', 'bchip') as HTMLButtonElement;
    b.dataset.testid = 'size-chip';
    b.dataset.size = String(n);
    b.textContent = n + 'x' + n;
    b.addEventListener('click', () => onPick(n));
    host.appendChild(b);
  }
}

/** Empty-cell tiles behind the canvas (pure CSS grid, w*h cells). */
export function buildTiles(host: HTMLElement, w: number, h: number): void {
  host.style.setProperty('--bw', String(w));
  host.style.setProperty('--bh', String(h));
  host.textContent = '';
  for (let i = 0; i < w * h; i++) host.appendChild(el('div', 'btile'));
}

export interface PaletteHandlers {
  onPick: (id: string) => void;
  onPage: (page: number) => void;
  onDragStart: (id: string, e: PointerEvent) => void;
}

function paletteButton(tool: ToolDef, h: PaletteHandlers): HTMLButtonElement {
  const b = el('button', 'btool') as HTMLButtonElement;
  b.dataset.testid = 'tool';
  b.dataset.tool = tool.id;
  b.title = tool.label;
  if (tool.kind === 'eraser') {
    b.classList.add('btool-eraser');
    b.textContent = '⌫';
  } else {
    const img = el('img') as HTMLImageElement;
    img.src = toolIcon(tool.id);
    img.alt = tool.label;
    img.draggable = false;
    b.appendChild(img);
  }
  b.addEventListener('click', () => h.onPick(tool.id));
  b.addEventListener('pointerdown', (e) => h.onDragStart(tool.id, e));
  return b;
}

export function buildPalette(host: HTMLElement, dots: HTMLElement, h: PaletteHandlers): void {
  host.textContent = '';
  dots.textContent = '';
  for (let p = 0; p < PAGES; p++) {
    const page = el('div', 'bpage');
    page.dataset.page = String(p);
    for (const tool of TOOLS.filter((t) => t.page === p)) page.appendChild(paletteButton(tool, h));
    host.appendChild(page);
    const dot = el('span', 'bdot');
    dot.dataset.testid = 'palette-page';
    dot.dataset.page = String(p);
    if (p === 0) dot.dataset.active = 'true';
    dots.appendChild(dot);
  }
  host.addEventListener('scroll', () => {
    const page = Math.round(host.scrollLeft / Math.max(1, host.clientWidth));
    for (const d of dots.children) {
      (d as HTMLElement).dataset.active = String(Number((d as HTMLElement).dataset.page) === page);
    }
    h.onPage(page);
  });
}
