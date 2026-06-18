/* Browser history for the app's screens (SSOT). The visible start-overlay is a
   pure function of history.state.sqView, and one popstate handler re-renders the
   right DOM on BACK and FORWARD - so the browser buttons navigate WITHIN the app
   and never an accidental exit. A `sqPlaying` entry makes Back from a played level
   return to the start menu. The builder owns its own (separate) history; nav
   defers to it via `builderActive()`. */

export type SqView = 'levels' | 'settings' | 'privacy';

export interface NavOverlay {
  open: () => void;
  close: () => void;
}

export interface NavDeps {
  levels: NavOverlay;
  settings: NavOverlay;
  privacy: NavOverlay;
  /** open the start menu (home) */
  openMenu: () => void;
  /** close the start menu (reveal the game underneath) */
  closeMenu: () => void;
  /** true while the builder/play-test owns the back stack - nav must stand down */
  builderActive: () => boolean;
}

export interface Nav {
  /** Open an overlay and push a history entry for it (guarded against double-push). */
  go: (view: SqView) => void;
  /** Cross the menu -> play boundary: push one play entry and reveal the game. */
  enterPlay: () => void;
  /** Picker -> play: turn the picker's entry INTO the single play entry. */
  consumePlayEntry: () => void;
  /** Step back one entry (every overlay X button calls this). */
  back: () => void;
  /** Decide what the logo/home affordance does given the current entry. */
  home: () => void;
  /** Boot/reload: re-open an overlay if the restored history entry asks for one. */
  syncToState: () => void;
  /** The single popstate handler - register LAST, after builder + play handlers. */
  onPopstate: () => void;
}

interface NavState {
  sqView?: SqView;
  sqPlaying?: boolean;
}

export function createNav(d: NavDeps): Nav {
  /** The overlays are a pure function of the target view (idempotent open/close). */
  const render = (view: SqView | null): void => {
    if (view === 'settings' || view === 'privacy') d.settings.open();
    else d.settings.close();
    if (view === 'privacy') d.privacy.open(); else d.privacy.close();
    if (view === 'levels') d.levels.open(); else d.levels.close();
  };

  const state = (): NavState => (history.state ?? {}) as NavState;

  return {
    go: (view) => {
      if (state().sqView !== view) history.pushState({ sqView: view }, '');
      render(view);
    },
    enterPlay: () => {
      history.pushState({ sqPlaying: true }, '');
      render(null);
      d.closeMenu();
    },
    consumePlayEntry: () => {
      history.replaceState({ sqPlaying: true }, '');
      render(null);
    },
    back: () => history.back(),
    home: () => {
      if (d.builderActive()) return; /* builder test-play has its own Back-to-editor */
      if (state().sqPlaying) history.back(); /* pop the play entry -> menu */
      else d.openMenu();
    },
    syncToState: () => {
      const v = state().sqView;
      if (v) render(v); /* a reload mid-overlay restores it; play/menu left as boot set */
    },
    onPopstate: () => {
      if (d.builderActive()) return; /* builder/play handlers own this transition */
      const st = state();
      render(st.sqView ?? null);
      if (st.sqView) return; /* an overlay is the target; menu stays underneath */
      if (st.sqPlaying) d.closeMenu(); else d.openMenu();
    }
  };
}
