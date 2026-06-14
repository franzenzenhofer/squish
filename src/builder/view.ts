/* Builder view — the controller. The board is the GAME's own canvas renderer
   (render.ts -> cardSession + drawFrame), the hint uses the canonical bubble,
   the header uses the canonical wordmark, and pieces drag up from the palette
   onto the board. This file only wires state <-> the reused components and the
   async solve/share. */

import type { LevelDef } from '../engine/types';
import type { Session } from '../game/session';
import {
  type BuilderState, createBuilderState, selectTool, placeAt, eraseAt, resize, toDef, fromDef,
  pieceAt, applyToolAt
} from './state';
import { structuralErrors, canSolveCheck } from './validate';
import { createSolveRunner, type SolveOutcome, type SolveStatus } from './solveDebounce';
import { buildChips, buildTiles, buildPalette } from './dom';
import { builderSession, drawBuilder, cellFromPoint } from './render';
import { toolIcon } from './icons';
import { saveCreation, listCreations, deleteCreation, getCreation, type KV, type CreationMeta } from './library';
import { buildShareUrl } from '../share/shareUrl';
import { drawQr } from '../share/qr';
import { shareCapabilities } from '../share/capabilities';
import { mountWordmark } from '../game/logo';
import { toast } from '../game/toast';

export interface SolveInfo { status: SolveOutcome; par: number; }

export interface BuilderDeps {
  s: Session;
  playDef: (def: LevelDef) => void;
  solveDef: (def: LevelDef) => Promise<SolveInfo>;
  onExit: () => void;
  closeMenu: () => void;
  kv?: KV;
}

export interface BuilderApi {
  open: (def?: LevelDef) => Promise<void>;
  close: () => void;
  isOpen: () => boolean;
  selectTool: (id: string) => void;
  activeTool: () => string;
  resize: (w: number, h: number) => void;
  place: (x: number, y: number) => void;
  erase: (x: number, y: number) => void;
  dragOff: (x: number, y: number) => void;
  getState: () => Record<string, unknown>;
  def: () => LevelDef;
  validate: () => Promise<SolveStatus>;
  play: () => Promise<void>;
  save: () => { id: string };
  share: () => string;
  listCreations: () => CreationMeta[];
  deleteCreation: (id: string) => void;
  editCreation: (id: string) => Promise<void>;
}

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

export function createBuilder(d: BuilderDeps): BuilderApi {
  const kv: KV = d.kv ?? localStorage;
  const root = $('builder');
  const bc = $('bc') as HTMLCanvasElement;
  let st: BuilderState = createBuilderState(6, 6);
  let editingId: string | null = null;
  let status: SolveStatus = 'idle';
  let lastPar = 0;
  let solveTimer = 0;
  let session: Session | null = null;
  let raf = 0;

  mountWordmark($('bLogo'));

  const runner = createSolveRunner(
    (def) => d.solveDef(def).then((r) => { lastPar = r.par; return r.status; }),
    (s) => { status = s; paintStatus(); }
  );

  function loop(now: number): void {
    if (!root.classList.contains('show')) return;
    drawBuilder(bc, session, now);
    raf = requestAnimationFrame(loop);
  }

  function paintStatus(): void {
    const pill = $('bStatus');
    pill.dataset.status = status;
    $('bStatusText').textContent =
      status === 'solvable' ? 'SOLVABLE'
        : status === 'unsolvable' ? 'NOT SOLVABLE'
          : status === 'checking' ? 'CHECKING…'
            : status === 'unknown' ? 'TOO TRICKY' : 'KEEP GOING';
    const locked = status !== 'solvable';
    for (const id of ['bSave', 'bShare']) $(id).dataset.locked = String(locked);
  }

  function paintBubble(): void {
    const errs = structuralErrors(st);
    const msg = errs[0] ?? (status === 'solvable' ? 'Lovely — share it with a friend!' : '');
    $('bBubbleText').textContent = msg;
    $('bBubble').classList.toggle('show', msg !== '');
  }

  function scheduleSolve(): void {
    if (!canSolveCheck(st)) { status = 'idle'; paintStatus(); return; }
    status = 'checking'; paintStatus();
    window.clearTimeout(solveTimer);
    solveTimer = window.setTimeout(() => runner.run(toDef(st)), 250);
  }

  function refresh(): void { session = builderSession(st); paintBubble(); paintStatus(); scheduleSolve(); }
  function edit(fn: () => void): void { fn(); refresh(); }

  /** Save (or update) the current board in Your Levels; returns its id. */
  function persist(): { id: string } {
    const def = { ...toDef(st), par: lastPar };
    if (editingId && getCreation(kv, editingId)) {
      saveCreation(kv, def, 'Level ' + listCreations(kv).length);
      return { id: editingId };
    }
    const id = saveCreation(kv, def, 'Level ' + (listCreations(kv).length + 1));
    editingId = id;
    return { id };
  }

  function setActive(id: string): void {
    selectTool(st, id);
    for (const b of root.querySelectorAll('[data-testid="tool"]')) {
      (b as HTMLElement).dataset.active = String((b as HTMLElement).dataset.tool === id);
    }
  }

  function reflectSize(): void {
    for (const c of root.querySelectorAll('[data-testid="size-chip"]')) {
      (c as HTMLElement).dataset.active = String(Number((c as HTMLElement).dataset.size) === st.w);
    }
  }

  function setSize(n: number): void {
    resize(st, n, n);
    reflectSize();
    buildTiles($('bTiles'), st.w, st.h);
    refresh();
  }

  /** A fresh blank board every time the editor opens (no resume). */
  function init(def?: LevelDef): void {
    st = def ? fromDef(def) : createBuilderState(6, 6);
    setActive('squishy');
    reflectSize();
    buildTiles($('bTiles'), st.w, st.h);
    refresh();
  }

  /** A happy floating piece that follows the finger while dragging (the icon is
      the gameplay sprite with mood 'happy'). dropToBoard places `tool` at the
      cell under release (off-board = nothing, so a lifted piece stays removed). */
  function dragPiece(tool: string, e: PointerEvent): void {
    const url = toolIcon(tool);
    if (!url) return; // eraser has no ghost
    const ghost = document.createElement('img');
    ghost.src = url; ghost.className = 'bghost';
    const at = (x: number, y: number): void => { ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; };
    at(e.clientX, e.clientY);
    document.body.appendChild(ghost);
    const move = (ev: PointerEvent): void => at(ev.clientX, ev.clientY);
    const up = (ev: PointerEvent): void => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      ghost.remove();
      const c = cellFromPoint(bc, ev.clientX, ev.clientY, st.w, st.h);
      if (c) edit(() => applyToolAt(st, tool, c[0], c[1]));
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  // --- board: tap empty to place; pick up an existing piece and drag it around
  //     (or off the board to delete); drag-paint over empty cells ---
  let painting: [number, number] | null = null;
  let lastCell = '';
  bc.addEventListener('pointerdown', (e) => {
    const c = cellFromPoint(bc, e.clientX, e.clientY, st.w, st.h);
    if (!c) return;
    const here = pieceAt(st, c[0], c[1]);
    if (here) {
      /* lift this piece and drag it (move on the board, or away to delete) */
      edit(() => eraseAt(st, c[0], c[1]));
      dragPiece(here, e);
      return;
    }
    bc.setPointerCapture(e.pointerId);
    painting = c; lastCell = c.join(',');
    edit(() => placeAt(st, c[0], c[1]));
  });
  bc.addEventListener('pointermove', (e) => {
    if (!painting) return;
    const c = cellFromPoint(bc, e.clientX, e.clientY, st.w, st.h);
    if (!c || c.join(',') === lastCell) return;
    lastCell = c.join(',');
    edit(() => placeAt(st, c[0], c[1]));
  });
  bc.addEventListener('pointerup', (e) => {
    if (painting && !cellFromPoint(bc, e.clientX, e.clientY, st.w, st.h)) {
      edit(() => eraseAt(st, painting![0], painting![1])); // painted then off-board -> delete
    }
    painting = null;
  });

  // drag a piece UP from the palette onto the board
  function onToolDragStart(id: string, e: PointerEvent): void {
    setActive(id);
    dragPiece(id, e);
  }

  buildChips($('bSizes'), setSize);
  buildPalette($('bPalette'), $('bDots'), { onPick: setActive, onPage: () => undefined, onDragStart: onToolDragStart });
  $('bPlay').addEventListener('click', () => void api.play());
  $('bSave').addEventListener('click', () => { try { api.save(); toast('Saved to Your Levels!'); } catch { toast('Make it solvable first!'); } });
  $('bShare').addEventListener('click', () => { try { openShare(api.share()); } catch { toast('Make it solvable first!'); } });
  $('bExit').addEventListener('click', () => api.close());

  function openShare(url: string): void {
    const sheet = $('bShareSheet');
    sheet.dataset.shown = 'true';
    drawQr($('bShareQr') as HTMLCanvasElement, url);
    $('bShareUrl').textContent = url;
    const caps = shareCapabilities();
    const sb = $('bShareNative') as HTMLButtonElement;
    sb.style.display = caps.share ? '' : 'none';
    const cb = $('bShareCopy') as HTMLButtonElement;
    cb.style.display = caps.clipboard ? '' : 'none';
    sb.onclick = (): void => { void navigator.share?.({ url }); };
    cb.onclick = (): void => { void navigator.clipboard?.writeText(url).then(() => toast('Link copied!')); };
  }
  $('bShareClose').addEventListener('click', () => { $('bShareSheet').dataset.shown = 'false'; });

  const api: BuilderApi = {
    open: (def): Promise<void> => {
      d.closeMenu(); root.classList.add('show'); d.s.mode = 'menu';
      init(def); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
      return Promise.resolve();
    },
    close: (): void => {
      cancelAnimationFrame(raf);
      root.classList.remove('show'); $('bShareSheet').dataset.shown = 'false';
      d.onExit();
    },
    isOpen: (): boolean => root.classList.contains('show'),
    selectTool: (id): void => setActive(id),
    activeTool: (): string => st.active,
    resize: (w): void => setSize(w),
    place: (x, y): void => edit(() => placeAt(st, x, y)),
    erase: (x, y): void => edit(() => eraseAt(st, x, y)),
    dragOff: (x, y): void => edit(() => eraseAt(st, x, y)),
    getState: (): Record<string, unknown> => ({
      w: st.w, h: st.h, target: st.target, dots: st.dots,
      cells: Object.fromEntries(st.cells), activeTool: st.active,
      structural: structuralErrors(st), solveStatus: status, par: lastPar,
      canPublish: status === 'solvable'
    }),
    def: (): LevelDef => ({ ...toDef(st), par: lastPar }),
    validate: async (): Promise<SolveStatus> => {
      if (!canSolveCheck(st)) return 'idle';
      const r = await d.solveDef(toDef(st));
      lastPar = r.par; status = r.status; paintStatus();
      return status;
    },
    play: async (): Promise<void> => {
      const def = { ...toDef(st), par: lastPar || 1 };
      if (status === 'solvable') persist(); // a playable level auto-saves
      cancelAnimationFrame(raf);
      root.classList.remove('show'); d.closeMenu(); d.playDef(def);
      return Promise.resolve();
    },
    save: (): { id: string } => {
      if (status !== 'solvable') throw new Error('not solvable');
      return persist();
    },
    share: (): string => {
      if (status !== 'solvable') throw new Error('not solvable');
      persist(); // sharing auto-saves to Your Levels
      return buildShareUrl({ ...toDef(st), par: lastPar });
    },
    listCreations: (): CreationMeta[] => listCreations(kv),
    deleteCreation: (id): void => { if (id === editingId) editingId = null; deleteCreation(kv, id); },
    editCreation: async (id): Promise<void> => {
      const c = getCreation(kv, id);
      if (c) { editingId = id; await api.open(c.def); }
    }
  };
  return api;
}
