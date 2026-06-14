/* Builder DOM builders — size chips and the paged tool palette (pages + a
   scroll-driven page indicator). The board is the game's own canvas (render.ts)
   and ALL palette gestures (scroll + drag-to-board) live in one place: the
   unified pointer handler in view.ts. No per-button listeners here. */

import { TOOLS, PAGES, type ToolDef } from './tools';
import { toolIcon } from './icons';
import { ICON_ERASER } from '../game/uiIcons';

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

function paletteButton(tool: ToolDef): HTMLButtonElement {
  const b = el('button', 'btool') as HTMLButtonElement;
  b.dataset.testid = 'tool';
  b.dataset.tool = tool.id;
  b.title = tool.label;
  if (tool.kind === 'eraser') {
    b.classList.add('btool-eraser');
    b.innerHTML = ICON_ERASER;
  } else {
    const img = el('img') as HTMLImageElement;
    img.src = toolIcon(tool.id);
    img.alt = tool.label;
    img.draggable = false;
    b.appendChild(img);
  }
  return b;
}

/** Reflect the carousel's scroll position onto the page dots. */
export function reflectPage(host: HTMLElement, dots: HTMLElement): void {
  const page = Math.round(host.scrollLeft / Math.max(1, host.clientWidth));
  for (const d of dots.children) {
    (d as HTMLElement).dataset.active = String(Number((d as HTMLElement).dataset.page) === page);
  }
}

export function buildPalette(host: HTMLElement, dots: HTMLElement): void {
  host.textContent = '';
  dots.textContent = '';
  for (let p = 0; p < PAGES; p++) {
    const page = el('div', 'bpage');
    page.dataset.page = String(p);
    for (const tool of TOOLS.filter((t) => t.page === p)) page.appendChild(paletteButton(tool));
    host.appendChild(page);
    const dot = el('span', 'bdot');
    dot.dataset.testid = 'palette-page';
    dot.dataset.page = String(p);
    if (p === 0) dot.dataset.active = 'true';
    dots.appendChild(dot);
  }
  host.addEventListener('scroll', () => reflectPage(host, dots));
}
