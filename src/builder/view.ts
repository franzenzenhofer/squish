/* Builder view — the controller. The board is the GAME's own canvas renderer
   (render.ts -> cardSession + drawFrame), the hint uses the canonical bubble,
   the header uses the canonical wordmark, and pieces drag up from the palette
   onto the board. This file only wires state <-> the reused components and the
   async solve/share. */

import type { LevelDef } from '../engine/types';
import type { Session } from '../game/session';
import {
  type BuilderState, createBuilderState, selectTool, placeAt, eraseAt, resize, toDef, fromDef,
  pieceAt, applyToolAt, countTool
} from './state';
import { toolById } from './tools';
import { structuralErrors, canSolveCheck } from './validate';
import { createSolveRunner, type SolveOutcome, type SolveStatus } from './solveDebounce';
import { buildChips, buildPalette } from './dom';
import { builderSession, drawBuilder, cellFromPoint } from './render';
import { toolIcon } from './icons';
import { saveCreation, updateCreation, listCreations, deleteCreation, getCreation, type KV, type CreationMeta } from './library';
import { buildShareUrl } from '../share/shareUrl';
import { drawQr } from '../share/qr';
import { shareCapabilities } from '../share/capabilities';
import { ICON_SHARE } from '../game/uiIcons';

const HEART_HINT = 'Tip: a heart in a corner stays solvable most of the time!';

/** A fresh editor opens on the smallest comfy board — a 4x4 (SSOT). */
const NEW_BOARD = 4;

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
  let st: BuilderState = createBuilderState(NEW_BOARD, NEW_BOARD);
  let editingId: string | null = null;
  let status: SolveStatus = 'idle';
  let lastPar = 0;
  let solveTimer = 0;
  let session: Session | null = null;
  let raf = 0;
  let lastMsg = '';
  let bubbleTimer = 0;
  let cornerTipShown = false; // the corner tip fires once per level creation
  let lastStage = -1; // last guided-build stage (-1 forces a fresh pre-select on open)
  const headerEl = document.querySelector('header') as HTMLElement; // the SHARED game header

  /* the browser Back button steps out: share sheet -> editor -> previous view.
     open()/openShare() push a history entry; the X buttons just call back(). */
  window.addEventListener('popstate', () => {
    if ($('bShareSheet').dataset.shown === 'true') { $('bShareSheet').dataset.shown = 'false'; return; }
    if (root.classList.contains('show')) api.close();
  });

  /** The speech bubble is the builder's ONLY notification, and it always fades —
      it shows a message once when it CHANGES (no re-spam on every edit) and
      auto-dismisses after a few seconds, exactly like the in-game bubble. */
  function showBubble(msg: string): void {
    if (!msg || msg === lastMsg) return;
    lastMsg = msg;
    $('bBubbleText').textContent = msg;
    $('bBubble').classList.add('show');
    window.clearTimeout(bubbleTimer);
    bubbleTimer = window.setTimeout(() => {
      $('bBubble').classList.remove('show');
      lastMsg = '';
    }, 3600);
  }

  /** An explicit notification (Saved, Link copied) — always shown, then fades. */
  function notify(msg: string): void { lastMsg = ''; showBubble(msg); }

  /** Dismiss the bubble now (the X), like the in-game caption's close button. */
  function hideBubble(): void {
    window.clearTimeout(bubbleTimer);
    $('bBubble').classList.remove('show');
    lastMsg = '';
  }

  /** True when the heart sits on one of the four board corners. */
  function heartInCorner(): boolean {
    const t = st.target;
    if (!t) return false;
    return (t[0] === 0 || t[0] === st.w - 1) && (t[1] === 0 || t[1] === st.h - 1);
  }

  /** The corner tip: shown ONCE per level creation, and only when the heart is
      placed somewhere OTHER than a corner (a gentle nudge, never nagging). */
  function maybeCornerTip(): void {
    if (cornerTipShown || status === 'solvable') return; // a solvable board needs no nudge
    if (st.target && !heartInCorner()) { cornerTipShown = true; showBubble(HEART_HINT); }
  }

  const runner = createSolveRunner(
    (def) => d.solveDef(def).then((r) => { lastPar = r.par; return r.status; }),
    (s) => { status = s; paintStatus(); if (s === 'solvable' && lastMsg === HEART_HINT) hideBubble(); }
  );

  /** Size the board to the largest square that fits its area — the game's own
      layout() rule (min of available width/height), so the editor board sits and
      scales EXACTLY like the real playing field. */
  function fitBoard(): void {
    /* clear the SHARED header that floats above the builder (reused, not redrawn) */
    const ph = headerEl.offsetHeight + 'px';
    if (root.style.paddingTop !== ph) root.style.paddingTop = ph;
    const wrap = $('bBoardWrap');
    const side = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight));
    if (side <= 0) return;
    const board = $('bBoard');
    if (board.style.width !== side + 'px') { board.style.width = side + 'px'; board.style.height = side + 'px'; }
  }

  /** Show the left/right edge fades only when the tool row can scroll that way. */
  function reflectPaletteEdges(): void {
    const pal = $('bPalette');
    const wrap = pal.parentElement as HTMLElement;
    const l = pal.scrollLeft > 2 ? '1' : '0';
    const r = pal.scrollLeft < pal.scrollWidth - pal.clientWidth - 2 ? '1' : '0';
    if (wrap.dataset.l !== l) wrap.dataset.l = l;
    if (wrap.dataset.r !== r) wrap.dataset.r = r;
  }

  function loop(now: number): void {
    if (!root.classList.contains('show')) return;
    fitBoard();
    reflectPaletteEdges();
    if (session) drawBuilder(bc, session, now);
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
    /* Play and Share need a proven-solvable board (heart + squishy + a solution) */
    const locked = status !== 'solvable';
    for (const id of ['bPlay', 'bShare']) $(id).dataset.locked = String(locked);
  }


  function scheduleSolve(): void {
    if (!canSolveCheck(st)) { status = 'idle'; paintStatus(); return; }
    status = 'checking'; paintStatus();
    window.clearTimeout(solveTimer);
    solveTimer = window.setTimeout(() => runner.run(toDef(st)), 250);
  }

  /** Guided build: only the heart is enabled until placed, then only the squishy,
      then the whole palette — others are greyed out and the next tool is
      pre-selected so a first-timer can't get lost. */
  function applyStage(): void {
    const stage = !st.target ? 0 : st.dots.length === 0 ? 1 : 2;
    const ok = (id: string): boolean => {
      const tool = toolById(id);
      /* a capped tool greys out once its limit is reached (portals = 2) */
      if (tool?.cap && countTool(st, id) >= tool.cap) return false;
      return stage === 2 ? true
        : stage === 1 ? id === 'squishy' || id === 'heart' || id === 'eraser'
          : id === 'heart';
    };
    for (const b of root.querySelectorAll('[data-testid="tool"]')) {
      (b as HTMLElement).dataset.disabled = String(!ok((b as HTMLElement).dataset.tool ?? ''));
    }
    /* pre-select the next tool only when the STAGE changes, so the choice does
       not snap back while the user is still tapping within a stage */
    if (stage !== lastStage) {
      lastStage = stage;
      if (stage === 0) { setActive('heart'); return; }
      if (stage === 1) { setActive('squishy'); return; }
    }
    markActive();
  }

  function refresh(): void {
    session = builderSession(st);
    applyStage();
    maybeCornerTip();
    paintStatus();
    scheduleSolve();
  }
  function edit(fn: () => void): void { fn(); refresh(); }

  /** Save (or update) the current board in Your Levels; returns its id. */
  function persist(): { id: string } {
    const def = { ...toDef(st), par: lastPar };
    if (editingId && getCreation(kv, editingId)) {
      updateCreation(kv, editingId, def); // update IN PLACE — never duplicate
      return { id: editingId };
    }
    const id = saveCreation(kv, def, 'Level ' + (listCreations(kv).length + 1));
    editingId = id;
    return { id };
  }

  function markActive(): void {
    for (const b of root.querySelectorAll('[data-testid="tool"]')) {
      (b as HTMLElement).dataset.active = String((b as HTMLElement).dataset.tool === st.active);
    }
  }
  /** Select a tool (the corner tip is tied to PLACEMENT, not selection). */
  function setActive(id: string): void {
    selectTool(st, id);
    markActive();
  }

  function reflectSize(): void {
    for (const c of root.querySelectorAll('[data-testid="size-chip"]')) {
      (c as HTMLElement).dataset.active = String(Number((c as HTMLElement).dataset.size) === st.w);
    }
  }

  function setSize(n: number): void {
    resize(st, n, n);
    reflectSize();
    refresh();
  }

  /** A fresh blank board every time the editor opens (no resume). */
  function init(def?: LevelDef): void {
    st = def ? fromDef(def) : createBuilderState(NEW_BOARD, NEW_BOARD);
    lastStage = -1; // re-arm the guided pre-select for this session
    cornerTipShown = false; // the corner tip is armed afresh for this creation
    $('bPalette').scrollLeft = 0; // always start scrolled left so the heart shows
    reflectSize();
    refresh(); // applyStage pre-selects the heart on a fresh board
  }

  /** A happy floating piece that follows the finger while dragging. On RELEASE it
      is placed at the cell under the finger (off-board release = a deliberate
      throw-away, so a lifted piece stays removed). On CANCEL (the OS steals the
      touch: notification, home gesture) the gesture is aborted and a piece that
      was lifted off the board (`origin`) is restored where it came from, never
      lost. `origin` is null for a fresh piece dragged out of the palette. */
  function dragPiece(tool: string, e: PointerEvent, origin: [number, number] | null = null): void {
    const url = toolIcon(tool);
    if (!url) { if (origin) edit(() => applyToolAt(st, tool, origin[0], origin[1])); return; } // eraser: nothing to carry
    const ghost = document.createElement('img');
    ghost.src = url; ghost.className = 'bghost';
    let lx = e.clientX, ly = e.clientY;
    const at = (x: number, y: number): void => { lx = x; ly = y; ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; };
    at(e.clientX, e.clientY);
    document.body.appendChild(ghost);
    /* Lock the touch to THIS drag: capture the pointer (reliable delivery even
       over the board/header) and block ALL native scroll/bounce for the drag's
       lifetime, so the palette's pan-x scroll can never hijack and freeze it. */
    try { bc.setPointerCapture(e.pointerId); } catch { /* mouse / unsupported */ }
    const blockScroll = (ev: TouchEvent): void => ev.preventDefault();
    document.addEventListener('touchmove', blockScroll, { passive: false });
    const move = (ev: PointerEvent): void => at(ev.clientX, ev.clientY);
    const end = (place: boolean): void => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('touchmove', blockScroll);
      try { bc.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      ghost.remove();
      const c = place ? cellFromPoint(bc, lx, ly, st.w, st.h) : null;
      if (c) edit(() => applyToolAt(st, tool, c[0], c[1]));        // dropped on the board
      else if (!place && origin) edit(() => applyToolAt(st, tool, origin[0], origin[1])); // cancelled -> restore
    };
    const onUp = (ev: PointerEvent): void => { at(ev.clientX, ev.clientY); end(true); };
    const onCancel = (): void => end(false); // the OS stole the touch: abort, restore
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
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
      /* lift this piece and drag it (move on the board, or away to delete); if the
         OS cancels the drag the piece is restored to `c` (its origin) */
      edit(() => eraseAt(st, c[0], c[1]));
      dragPiece(here, e, c);
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
  bc.addEventListener('pointercancel', () => { painting = null; }); // never stay stuck in paint mode

  /* The palette is a plain, fast, NATIVE left-right scroller (touch-action:pan-x
     gives momentum, no snap, no pages). The ONLY thing JS adds is the drag-out:
     a clear UPWARD press-and-move lifts the piece under the finger and carries it
     to the board. A horizontal swipe is the browser's native scroll (we never
     touch it); a plain tap selects the tool. Tracked on DOCUMENT so an upward
     drag keeps flowing once the finger leaves the palette. */
  const DEAD = 8;
  function setupPaletteGestures(): void {
    const pal = $('bPalette');
    let sx = 0, sy = 0, decided = false, tool = '', listening = false;
    const onMove = (e: PointerEvent): void => {
      if (decided) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) < DEAD && Math.abs(dy) < DEAD) return;
      decided = true;
      end();
      if (dy < -DEAD && Math.abs(dy) >= Math.abs(dx) && tool) {
        setActive(tool); dragPiece(tool, e); // upward -> carry onto the board
      } // otherwise it was a horizontal swipe: leave it to the native scroll
    };
    const onUp = (): void => { if (!decided && tool) setActive(tool); end(); }; // tap selects
    /* guard against listener accumulation: a 2nd finger landing before the 1st
       gesture resolves must NOT stack a permanent extra onMove on document */
    const end = (): void => {
      if (!listening) return;
      listening = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', endOnly);
    };
    const endOnly = (): void => end(); // a cancel (native scroll took over) never selects
    pal.addEventListener('pointerdown', (e) => {
      if (listening) return; // a gesture is already in flight (multi-touch)
      tool = ((e.target as HTMLElement).closest('[data-tool]') as HTMLElement | null)?.dataset.tool ?? '';
      sx = e.clientX; sy = e.clientY; decided = false; listening = true;
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', endOnly);
    });
  }

  buildChips($('bSizes'), setSize);
  buildPalette($('bPalette'));
  setupPaletteGestures();
  /* canonical share glyph beside the label (DRY, from uiIcons) */
  /* the editor's action Share is text-only (no icon); the share SHEET's native
     button keeps the canonical share glyph */
  $('bShare').textContent = 'Share';
  $('bShareNative').innerHTML = ICON_SHARE + 'Share';
  $('bPlay').addEventListener('click', () => void api.play());
  $('bShare').addEventListener('click', () => { try { openShare(api.share()); } catch { notify('Make it solvable first!'); } });
  /* New = a fresh blank board (Play and Share already auto-save, so no Save button) */
  $('bNew').addEventListener('click', () => { editingId = null; init(); });
  $('bExit').addEventListener('click', () => history.back());
  $('bBubbleX').addEventListener('click', hideBubble);

  function openShare(url: string): void {
    const sheet = $('bShareSheet');
    history.pushState({ sqShareSheet: true }, '');
    sheet.dataset.shown = 'true';
    drawQr($('bShareQr') as HTMLCanvasElement, url);
    const link = $('bShareUrl') as HTMLAnchorElement;
    link.textContent = url;
    link.href = url;
    /* open the link reliably even inside the iOS app:// webview (where a plain
       anchor can be swallowed): one tap opens it in the system browser */
    link.onclick = (e): void => { e.preventDefault(); window.open(url, '_blank', 'noopener'); };
    const caps = shareCapabilities();
    const sb = $('bShareNative') as HTMLButtonElement;
    sb.style.display = caps.share ? '' : 'none';
    const cb = $('bShareCopy') as HTMLButtonElement;
    cb.style.display = caps.clipboard ? '' : 'none';
    sb.onclick = (): void => { void navigator.share?.({ url }); };
    cb.onclick = (): void => { void navigator.clipboard?.writeText(url).then(() => notify('Link copied!')); };
  }
  $('bShareClose').addEventListener('click', () => history.back());

  const api: BuilderApi = {
    open: (def): Promise<void> => {
      d.closeMenu();
      if (!history.state?.sqBuilder) history.pushState({ sqBuilder: true }, '');
      document.body.classList.add('building'); // swap the shared header into editor mode
      root.classList.add('show'); d.s.mode = 'menu';
      init(def); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
      return Promise.resolve();
    },
    close: (): void => {
      cancelAnimationFrame(raf);
      painting = null; // never carry a half-finished paint/drag into the next open
      hideBubble();
      document.body.classList.remove('building'); // restore the game header
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
      canPublish: status === 'solvable', playEnabled: status === 'solvable'
    }),
    def: (): LevelDef => ({ ...toDef(st), par: lastPar }),
    validate: async (): Promise<SolveStatus> => {
      if (!canSolveCheck(st)) return 'idle';
      const r = await d.solveDef(toDef(st));
      lastPar = r.par; status = r.status; paintStatus();
      return status;
    },
    play: async (): Promise<void> => {
      /* Play is gated on a proven-solvable board (heart + squishy + a solution) */
      if (status !== 'solvable') { notify('Make it solvable first!'); return Promise.resolve(); }
      persist(); // a playable level auto-saves to Your Levels
      cancelAnimationFrame(raf);
      document.body.classList.remove('building'); // the play view uses the normal game header
      root.classList.remove('show'); d.closeMenu(); d.playDef({ ...toDef(st), par: lastPar || 1 });
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
