/* Builder DOM builders — the size chips, the paged tool palette, and the board
   cell grid. The grid is a CSS grid of real buttons (one per cell) carrying
   data-x / data-y / data-fill: it is both the touch surface AND the assertion
   surface, so an AI or Playwright drives and reads the board without any canvas
   pixel guessing. Pointer drag is tracked here; off-board release deletes. */

import { TOOLS, PAGES, type ToolDef } from './tools';
import { toolIcon } from './icons';

const el = (tag: string, cls?: string): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
};

export const SIZES = [4, 5, 6, 7, 8];

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

function paletteButton(tool: ToolDef, onPick: (id: string) => void): HTMLButtonElement {
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
    b.appendChild(img);
  }
  b.addEventListener('click', () => onPick(tool.id));
  return b;
}

export function buildPalette(host: HTMLElement, dots: HTMLElement, onPick: (id: string) => void): void {
  host.textContent = '';
  dots.textContent = '';
  for (let p = 0; p < PAGES; p++) {
    const page = el('div', 'bpage');
    page.dataset.page = String(p);
    for (const tool of TOOLS.filter((t) => t.page === p)) page.appendChild(paletteButton(tool, onPick));
    host.appendChild(page);
    const dot = el('span', 'bdot');
    dot.dataset.testid = 'palette-page';
    dot.dataset.page = String(p);
    dots.appendChild(dot);
  }
}

export interface GridHandlers {
  onDown: (x: number, y: number) => void;
  onEnter: (x: number, y: number) => void;
  onOutside: (x: number, y: number) => void;
}

function cellAtPoint(grid: HTMLElement, cx: number, cy: number): [number, number] | null {
  const t = document.elementFromPoint(cx, cy) as HTMLElement | null;
  const cell = t?.closest('.bcell') as HTMLElement | null;
  if (!cell || !grid.contains(cell)) return null;
  return [Number(cell.dataset.x), Number(cell.dataset.y)];
}

export function buildGrid(grid: HTMLElement, w: number, h: number, hx: GridHandlers): void {
  grid.textContent = '';
  grid.style.setProperty('--bw', String(w));
  grid.style.setProperty('--bh', String(h));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = el('button', 'bcell') as HTMLButtonElement;
      c.dataset.testid = 'cell';
      c.dataset.x = String(x);
      c.dataset.y = String(y);
      c.dataset.fill = 'empty';
      grid.appendChild(c);
    }
  }
  let down: [number, number] | null = null;
  let last = '';
  grid.onpointerdown = (e): void => {
    const hit = cellAtPoint(grid, e.clientX, e.clientY);
    if (!hit) return;
    grid.setPointerCapture(e.pointerId);
    down = hit;
    last = hit.join(',');
    hx.onDown(hit[0], hit[1]);
  };
  grid.onpointermove = (e): void => {
    if (!down) return;
    const hit = cellAtPoint(grid, e.clientX, e.clientY);
    if (!hit || hit.join(',') === last) return;
    last = hit.join(',');
    hx.onEnter(hit[0], hit[1]);
  };
  grid.onpointerup = (e): void => {
    if (down && !cellAtPoint(grid, e.clientX, e.clientY)) hx.onOutside(down[0], down[1]);
    down = null;
  };
}

/** Reflect a cell's content: data-fill + the piece icon (empty clears it). */
export function setCellFill(grid: HTMLElement, x: number, y: number, toolId: string | null): void {
  const c = grid.querySelector(`.bcell[data-x="${x}"][data-y="${y}"]`) as HTMLElement | null;
  if (!c) return;
  c.dataset.fill = toolId ?? 'empty';
  c.textContent = '';
  if (!toolId) return;
  const url = toolIcon(toolId);
  if (!url) return;
  const img = el('img') as HTMLImageElement;
  img.src = url;
  c.appendChild(img);
}
