/* Test API — window.__squishy lets e2e tests (and AI agents) drive the real
   game: read state, perform awaited moves, load levels, query the oracle's
   solution. Active in dev builds or with ?test=1. */
import { ser } from '../engine/core';
import type { Dir } from '../engine/types';
import type { Mode, Session } from './session';

export interface TestApiDeps {
  s: Session;
  doMove: (d: Dir) => void;
  loadLevel: (n: number) => void;
  startDaily: () => void;
  undo: () => void;
  retry: () => void;
  toggleHintMode: () => void;
  dismissIntro: () => void;
  closeMenu: () => void;
  solution: () => Dir[] | null;
}

export interface SquishyTestApi {
  state: () => {
    li: number; moves: number; mode: Mode; play: string; line: string;
    ser: string; winnable: boolean | null; oracleReady: boolean;
  };
  move: (d: Dir) => Promise<{ mode: Mode; moves: number }>;
  solution: () => string[] | null;
  loadLevel: (n: number) => Promise<void>;
  startDaily: () => Promise<void>;
  undo: () => void;
  retry: () => void;
  toggleHintMode: () => void;
  dismissIntro: () => void;
  closeMenu: () => void;
  setInstantAnims: (b: boolean) => void;
  waitIdle: () => Promise<Mode>;
}

declare global {
  interface Window {
    __squishy?: SquishyTestApi;
  }
}

const SETTLED: Mode[] = ['idle', 'win', 'lose', 'intro', 'menu'];

export function installTestApi(d: TestApiDeps): void {
  const enabled = import.meta.env.DEV ||
    new URLSearchParams(window.location.search).has('test');
  if (!enabled) return;
  const { s } = d;

  const waitFor = (ok: () => boolean): Promise<void> =>
    new Promise((resolve) => {
      const poll = (): void => {
        if (ok()) resolve();
        else setTimeout(poll, 16);
      };
      poll();
    });

  const waitIdle = async (): Promise<Mode> => {
    await waitFor(() => SETTLED.includes(s.mode));
    return s.mode;
  };

  window.__squishy = {
    state: () => ({
      li: s.li,
      moves: s.moves,
      mode: s.mode,
      play: s.play.kind === 'daily' ? 'daily:' + s.play.date : 'campaign',
      line: s.line.join(''),
      ser: ser(s.gs),
      winnable: s.oracle
        ? (s.oracle.dist.has(ser(s.gs)) ? true : s.oracle.policy.has(ser(s.gs)) ? false : null)
        : null,
      oracleReady: s.oracle !== null
    }),
    move: async (dir: Dir) => {
      d.doMove(dir);
      await waitIdle();
      return { mode: s.mode, moves: s.moves };
    },
    solution: () => d.solution()?.map((x) => x as string) ?? null,
    loadLevel: async (n: number) => {
      d.loadLevel(n);
      await waitIdle();
    },
    startDaily: async () => {
      d.startDaily();
      await waitIdle();
    },
    undo: d.undo,
    retry: d.retry,
    toggleHintMode: d.toggleHintMode,
    dismissIntro: d.dismissIntro,
    closeMenu: d.closeMenu,
    setInstantAnims: (b: boolean) => {
      s.instantAnims = b;
    },
    waitIdle
  };
}
