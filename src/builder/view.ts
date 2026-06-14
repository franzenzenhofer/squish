/* Builder view — the controller that wires the board, palette, validation and
   actions into one screen, and exposes a deterministic API the test harness
   drives. State lives in the pure machine (state.ts); this owns DOM + async
   solve + share. Kept lean by delegating DOM building to dom.ts and icons.ts. */

import type { LevelDef } from '../engine/types';
import type { Session } from '../game/session';
import {
  type BuilderState, createBuilderState, selectTool, placeAt, eraseAt, resize,
  toDef, fromDef
} from './state';
import { structuralErrors, canSolveCheck } from './validate';
import { createSolveRunner, type SolveOutcome, type SolveStatus } from './solveDebounce';
import { buildChips, buildPalette, buildGrid, setCellFill } from './dom';
import { saveCreation, listCreations, deleteCreation, getCreation, type KV, type CreationMeta } from './library';
import { buildShareUrl } from '../share/shareUrl';
import { drawQr } from '../share/qr';
import { shareCapabilities } from '../share/capabilities';
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
  const grid = $('bGrid');
  let st: BuilderState = createBuilderState(6, 6);
  let editingId: string | null = null;
  let status: SolveStatus = 'idle';
  let lastPar = 0;
  let solveTimer = 0;

  const runner = createSolveRunner(
    (def) => d.solveDef(def).then((r) => { lastPar = r.par; return r.status; }),
    (s) => { status = s; paintStatus(); }
  );

  function toolFillAt(x: number, y: number): string | null {
    if (st.target && st.target[0] === x && st.target[1] === y) return 'heart';
    if (st.dots.some((p) => p[0] === x && p[1] === y)) return 'squishy';
    return st.cells.get(x + ',' + y) ?? null;
  }

  function repaintBoard(): void {
    buildGrid(grid, st.w, st.h, {
      onDown: (x, y) => edit(() => placeAt(st, x, y)),
      onEnter: (x, y) => edit(() => placeAt(st, x, y)),
      onOutside: (x, y) => edit(() => eraseAt(st, x, y))
    });
    for (let y = 0; y < st.h; y++) {
      for (let x = 0; x < st.w; x++) setCellFill(grid, x, y, toolFillAt(x, y));
    }
  }

  function paintCells(): void {
    for (let y = 0; y < st.h; y++) {
      for (let x = 0; x < st.w; x++) setCellFill(grid, x, y, toolFillAt(x, y));
    }
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
    const b = $('bBubble');
    const msg = errs[0] ?? (status === 'solvable' ? 'Lovely - share it with a friend!' : '');
    b.dataset.shown = String(msg !== '');
    $('bBubbleText').textContent = msg;
  }

  function scheduleSolve(): void {
    if (!canSolveCheck(st)) { status = 'idle'; paintStatus(); return; }
    status = 'checking'; paintStatus();
    window.clearTimeout(solveTimer);
    solveTimer = window.setTimeout(() => runner.run(toDef(st)), 250);
  }

  function refresh(): void { paintCells(); paintBubble(); paintStatus(); scheduleSolve(); }
  function edit(fn: () => void): void { fn(); refresh(); }

  function setActive(id: string): void {
    selectTool(st, id);
    for (const b of root.querySelectorAll('[data-testid="tool"]')) {
      (b as HTMLElement).dataset.active = String((b as HTMLElement).dataset.tool === id);
    }
  }

  function setSize(n: number): void {
    resize(st, n, n);
    for (const c of root.querySelectorAll('[data-testid="size-chip"]')) {
      (c as HTMLElement).dataset.active = String(Number((c as HTMLElement).dataset.size) === n);
    }
    repaintBoard();
    paintBubble(); paintStatus(); scheduleSolve();
  }

  function load(def?: LevelDef): void {
    st = def ? fromDef(def) : createBuilderState(6, 6);
    if (!def) { st.target = [Math.floor(st.w / 2), 1]; st.dots = [[Math.floor(st.w / 2), st.h - 2]]; }
    setActive('squishy');
    setSize(st.w);
    repaintBoard();
    refresh();
  }

  buildChips($('bSizes'), setSize);
  buildPalette($('bPalette'), $('bDots'), setActive);
  $('bPlay').addEventListener('click', () => void api.play());
  $('bSave').addEventListener('click', () => { try { api.save(); toast('Saved to Your Creations!'); } catch { toast('Make it solvable first!'); } });
  $('bShare').addEventListener('click', () => { try { openShare(api.share()); } catch { toast('Make it solvable first!'); } });
  $('bExit')?.addEventListener('click', () => api.close());

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
  $('bShareClose')?.addEventListener('click', () => { $('bShareSheet').dataset.shown = 'false'; });

  const api: BuilderApi = {
    open: (def): Promise<void> => { d.closeMenu(); root.classList.add('show'); d.s.mode = 'menu'; load(def); return Promise.resolve(); },
    close: (): void => { root.classList.remove('show'); $('bShareSheet').dataset.shown = 'false'; d.onExit(); },
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
      root.classList.remove('show');
      d.closeMenu();
      d.playDef(def);
      return Promise.resolve();
    },
    save: (): { id: string } => {
      if (status !== 'solvable') throw new Error('not solvable');
      const def = { ...toDef(st), par: lastPar };
      if (editingId && getCreation(kv, editingId)) {
        saveCreation(kv, def, 'Level ' + (listCreations(kv).length));
        return { id: editingId };
      }
      const id = saveCreation(kv, def, 'Level ' + (listCreations(kv).length + 1));
      editingId = id;
      return { id };
    },
    share: (): string => {
      if (status !== 'solvable') throw new Error('not solvable');
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
