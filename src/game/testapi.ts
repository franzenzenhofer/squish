/* Test API — window.__squishy lets e2e tests (and AI agents) drive the real
   game: read state, perform awaited moves, load levels, query the oracle's
   solution. Active in dev builds or with ?test=1. */
import { BANNER_COMBOS, BANNER_SIZES, type Variant, renderBannerFrames, renderBannerStatic } from './banners';
import { ser } from '../engine/core';
import type { Dir } from '../engine/types';
import type { Mode, Session } from './session';
import type { Settings } from './settings';
import { spriteIcon } from './spriteIcon';

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let bin = '';
  new Uint8Array(buf).forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

export interface TestApiDeps {
  s: Session;
  doMove: (d: Dir) => void;
  loadLevel: (n: number) => void;
  loadTestLevel: (di: number) => void;
  startDaily: () => void;
  undo: () => void;
  retry: () => void;
  toggleHintMode: () => void;
  dismissIntro: () => void;
  closeMenu: () => void;
  tapCell: (x: number, y: number) => void;
  solution: () => Dir[] | null;
  applySettings: (patch?: Partial<Omit<Settings, 'v'>>) => void;
}

export interface SquishyTestApi {
  state: () => {
    li: number; moves: number; mode: Mode; play: string; line: string;
    ser: string; winnable: boolean | null; oracleReady: boolean;
  };
  move: (d: Dir) => Promise<{ mode: Mode; moves: number }>;
  solution: () => string[] | null;
  /** Drive the current level to the win: dismiss intros, then replay the oracle's
      optimal line move by move. Resolves with the final mode ('win' on success). */
  solve: () => Promise<Mode>;
  loadLevel: (n: number) => Promise<void>;
  loadTestLevel: (di: number) => Promise<void>;
  startDaily: () => Promise<void>;
  setSettings: (patch: Partial<Omit<Settings, 'v'>>) => void;
  undo: () => void;
  retry: () => void;
  toggleHintMode: () => void;
  dismissIntro: () => void;
  closeMenu: () => void;
  tapCell: (x: number, y: number) => void;
  setInstantAnims: (b: boolean) => void;
  waitIdle: () => Promise<Mode>;
  /** data URL of a piece icon drawn by the real SSOT painter (sprite or field) */
  iconURL: (name: string, kind?: 'sprite' | 'field') => string;
}

export interface SquishyBannerApi {
  /** every size x variant combo to generate; `animated` follows the variant */
  combos: () => { size: string; variant: string; animated: boolean }[];
  /** base64 (no data: prefix) WebP bytes for one static size x variant combo */
  still: (sizeKey: string, variant: string) => Promise<string>;
  /** base64 PNG frames + per-frame delay (ms) — only valid where animated:true.
      The caller muxes these into an animated WebP via the img2webp CLI. */
  frames: (sizeKey: string, variant: string) => Promise<{ png: string; delay: number }[]>;
}

declare global {
  interface Window {
    __squishBanners?: SquishyBannerApi;
  }
}

/** Test/build-time API for generating ad banners — always available (this
    runs headless via Playwright, never in a player's real session). */
export function installBannerApi(): void {
  const findSize = (key: string) => {
    const s = BANNER_SIZES.find((x) => x.key === key);
    if (!s) throw new Error(`unknown banner size ${key}`);
    return s;
  };
  window.__squishBanners = {
    combos: () => BANNER_COMBOS,
    still: async (sizeKey, variant) =>
      blobToBase64(await renderBannerStatic(findSize(sizeKey), variant as Variant)),
    frames: async (sizeKey, variant) => {
      const frames = await renderBannerFrames(findSize(sizeKey), variant as Variant);
      return Promise.all(frames.map(async (f) => ({ png: await blobToBase64(f.png), delay: f.delay })));
    }
  };
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

  /** Tap through every queued first-meet card until the board is interactive. */
  const dismissAllIntros = async (): Promise<void> => {
    for (let i = 0; i < 60 && s.mode === 'intro'; i++) {
      d.dismissIntro();
      await new Promise((r) => setTimeout(r, 16));
    }
  };

  window.__squishy = {
    state: () => ({
      li: s.li,
      moves: s.moves,
      mode: s.mode,
      play: s.play.kind === 'daily' ? 'daily:' + s.play.date
        : s.play.kind === 'debug' ? 'debug:' + s.play.di
          : s.play.kind === 'custom' ? 'custom:' + s.play.source : 'campaign',
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
    solve: async (): Promise<Mode> => {
      await dismissAllIntros();
      await waitFor(() => s.oracle !== null); /* the oracle backs solution() */
      for (let i = 0; i < 200 && s.mode !== 'win'; i++) {
        const sol = d.solution();
        if (!sol || sol.length === 0) break;
        d.doMove(sol[0] as Dir);
        await waitIdle();
        if (s.mode === 'intro') await dismissAllIntros();
      }
      return s.mode;
    },
    loadLevel: async (n: number) => {
      d.loadLevel(n);
      /* resolve only when the requested level is truly active AND solver-ready, so
         a caller can immediately read state()/solution() — the AI-driveable contract */
      await waitFor(() => s.li === n && SETTLED.includes(s.mode) && s.oracle !== null);
    },
    loadTestLevel: async (di: number) => {
      d.loadTestLevel(di);
      await waitIdle();
    },
    startDaily: async () => {
      d.startDaily();
      await waitIdle();
    },
    setSettings: (patch) => d.applySettings(patch),
    undo: d.undo,
    retry: d.retry,
    toggleHintMode: d.toggleHintMode,
    dismissIntro: d.dismissIntro,
    closeMenu: d.closeMenu,
    tapCell: d.tapCell,
    setInstantAnims: (b: boolean) => {
      s.instantAnims = b;
    },
    waitIdle,
    iconURL: (name: string, kind?: 'sprite' | 'field') => spriteIcon(name, kind ? { kind } : {})
  };
}
