/* First-meet cards — the first time a friend or board element appears, a cute
   card pops in: a live portrait, a 3-tile looping demo of how it behaves, and
   one short line. Tap (or 7s) dismisses. Met kinds are kept in localStorage. */
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import { FLD } from '../fields';
import { SPR } from '../sprites';
import { easeOC } from './fx';
import type { Dir4 } from '../lib/types';
import type { Session } from './session';
import { INTRO_SPECS, LOOP_MS, type IntroSpec, type IntroTile } from './introSpecs';

/* v2: first-meet now covers elements too, so everyone re-meets the cast once */
const MET_KEY = 'squishy-met-v2';
const AUTO_MS = 7000;

/* element kind -> field renderer (FLD) key; nom/star are sprites, handled
   apart. Mirrors the dispatch in render.ts drawFields(). */
const TILE_FIELD: Record<string, string> = {
  wall: 'wall', ice: 'ice', honey: 'honey', oneway: 'oneway',
  split: 'sparkle', portal: 'portal', turn: 'turner',
  mushroom: 'mushroom', breeze: 'pinwheel', jelly: 'jelly'
};

interface TileBox { px: number; py: number; cell: number; now: number; gx: number; gy: number }

/** Draw one demo-strip tile (the element or obstacle that sits on it). */
function drawTile(
  ctx: CanvasRenderingContext2D, tile: IntroTile, o: TileBox,
  dir: Dir4 | undefined, cleared: boolean
): void {
  if (tile === 'floor') return;
  if (tile === 'nom') {
    if (!cleared) SPR.nomster?.(ctx, { x: o.px, y: o.py, cell: o.cell, now: o.now });
    return;
  }
  if (tile === 'star') {
    if (!cleared) {
      SPR.star?.(ctx, { x: o.px, y: o.py, cell: o.cell, now: o.now, r: o.cell * 0.26, seed: 5, idle: true });
    }
    return;
  }
  if (tile === 'ice' && cleared) {
    FLD.shards?.(ctx, o);
    return;
  }
  FLD[TILE_FIELD[tile] ?? '']?.(ctx, { ...o, dir });
}

/** Draw the big portrait icon for a friend/mover sprite or an element field. */
function drawIcon(ctx: CanvasRenderingContext2D, spec: IntroSpec, now: number): void {
  if (spec.kind === 'nom') {
    SPR.nomster?.(ctx, { x: 48, y: 50, cell: 96, now });
    return;
  }
  const fld = TILE_FIELD[spec.kind];
  if (fld) {
    FLD[fld]?.(ctx, { px: 48, py: 50, cell: 88, now, gx: 0, gy: 0, dir: spec.tileDir });
    return;
  }
  SPR[spec.kind === 'dot' ? 'star' : spec.kind]?.(ctx, {
    x: 48, y: 52, cell: 110, now, idle: true, mood: 'happy', seed: 3
  });
}

function getMet(): Set<string> {
  try {
    const raw = localStorage.getItem(MET_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* fresh */
  }
  return new Set();
}

function markMet(kind: string): void {
  const met = getMet();
  met.add(kind);
  try {
    localStorage.setItem(MET_KEY, JSON.stringify([...met]));
  } catch {
    /* storage blocked — they'll meet again */
  }
}

/** Which intro-spec keys appear in this level? Friends first, then the other
    movers, then board elements — so a card queue greets them in that order. */
function presentKinds(s: Session): string[] {
  const out: string[] = [];
  const gs = s.level.initState;
  const lv = s.level;
  const pairs: Array<[number, string]> = [
    [gs.penguins.length, 'penguin'], [gs.bunnies.length, 'bunny'],
    [gs.frogs.length, 'frog'], [gs.bears.length, 'bear'],
    [gs.ghosts.length, 'ghost'], [gs.pigs.length, 'pig'],
    [gs.cats.length, 'cat'], [gs.pandas.length, 'panda'],
    [gs.chicks.length, 'chick'],
    [gs.boxes.length, 'box'], [gs.balloons.length, 'balloon'],
    [gs.snails.length, 'snail'],
    [gs.stars.size, 'star'],
    [lv.walls.size, 'wall'], [lv.ice.size, 'ice'], [lv.noms.size, 'nom'],
    [lv.sticky.size, 'honey'], [lv.oneway.size, 'oneway'],
    [lv.split.size, 'split'], [lv.portal.size, 'portal'],
    [lv.turn.size, 'turn'], [lv.mush.size, 'mushroom'],
    [lv.breeze.size, 'breeze'], [lv.jelly.size, 'jelly']
  ];
  for (const [n, kind] of pairs) if (n > 0) out.push(kind);
  return out;
}

export interface Intro {
  /** call after applyLevel — shows cards for unmet friends, true if shown */
  maybeShow: (s: Session) => boolean;
  /** dismiss the current card (next queued card or back to idle) */
  dismiss: () => void;
  isOpen: () => boolean;
}

export function createIntro(s: Session, onAllDismissed: () => void): Intro {
  const el = document.getElementById('intro') as HTMLElement;
  const elName = document.getElementById('introName') as HTMLElement;
  const elLine = document.getElementById('introLine') as HTMLElement;
  const pc = document.getElementById('introP') as HTMLCanvasElement;
  const dc = document.getElementById('introD') as HTMLCanvasElement;
  let queue: IntroSpec[] = [];
  let current: IntroSpec | null = null;
  let raf = 0;
  let openedAt = 0;
  let autoTimer: number | null = null;

  const drawPortrait = (now: number): void => {
    const ctx = pc.getContext('2d');
    if (!ctx || !current) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    pc.width = 96 * dpr;
    pc.height = 96 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawIcon(ctx, current, now);
  };

  const drawDemo = (now: number): void => {
    const ctx = dc.getContext('2d');
    if (!ctx || !current) return;
    const spec = current;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cell = 62;
    const w = cell * 3 + 16;
    const h = cell + 16;
    dc.width = w * dpr;
    dc.height = h * dpr;
    dc.style.width = w + 'px';
    dc.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = (now - openedAt) % LOOP_MS;
    const cxAt = (gx: number): number => 8 + (gx + 0.5) * cell;
    const cy = 8 + cell / 2;
    /* tiles */
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i % 2 === 0 ? 0.55 : 0.9;
      ctx.fillStyle = i % 2 === 0 ? C.lattice : C.latticeAlt;
      U.rrect(ctx, 8 + i * cell + 2, 8 + 2, cell - 4, cell - 4, cell * 0.18);
      ctx.fill();
      ctx.globalAlpha = 1;
      const tile = spec.tiles[i] as IntroTile;
      const cleared = !!(spec.clearTile && spec.clearTile.at === i && t >= spec.clearTile.t);
      drawTile(ctx, tile, { px: cxAt(i), py: cy, cell, now, gx: i, gy: 0 }, spec.tileDir, cleared);
    }
    /* swipe chevron(s) */
    for (const ct of spec.chevrons) {
      const age = t - ct;
      if (age < 0 || age > 600) continue;
      const a = age < 120 ? age / 120 : 1 - (age - 120) / 480;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a) * 0.9;
      ctx.strokeStyle = C.heart;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const px = 8 + cell * 1.5 + (age / 600) * cell * 0.5;
      ctx.beginPath();
      ctx.moveTo(px - 8, cy - cell * 0.62);
      ctx.lineTo(px + 6, cy - cell * 0.52);
      ctx.lineTo(px - 8, cy - cell * 0.42);
      ctx.stroke();
      ctx.restore();
    }
    /* friends star as themselves; elements are demoed by a plain squishy */
    const actorName = spec.actor ?? (spec.kind === 'dot' ? 'squishy' : spec.kind);
    /* splitter: a static twin stays behind once the actor passes */
    if (spec.clone && t >= spec.clone.t) {
      SPR[actorName]?.(ctx, {
        x: cxAt(spec.clone.at), y: cy, cell, now,
        r: cell * 0.3, mood: 'happy', seed: 12, idle: true
      });
    }
    /* portal: the actor blinks out of one tile and into its twin */
    if (spec.teleport) {
      const tp = spec.teleport;
      let ax = tp.at;
      let scl = 1;
      if (t >= tp.t - 200 && t < tp.t) scl = Math.max(0.05, (tp.t - t) / 200);
      else if (t >= tp.t && t < tp.t + 200) { ax = tp.to; scl = Math.max(0.05, (t - tp.t) / 200); }
      else if (t >= tp.t + 200) ax = tp.to;
      SPR[actorName]?.(ctx, {
        x: cxAt(ax), y: cy, cell, now, r: cell * 0.3 * scl,
        mood: 'happy', seed: 4, idle: scl === 1
      });
      return;
    }
    /* actor position from keyframes */
    const keys = spec.keys;
    let x = keys[0]?.x ?? 0;
    let hopLift = 0;
    let zzz = false;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!k) continue;
      if (t >= k.t) {
        x = k.x;
        zzz = !!k.zzz && t < k.t + 700;
      } else {
        const prev = keys[i - 1];
        if (prev) {
          const q = easeOC(Math.min(1, (t - prev.t) / Math.max(1, k.t - prev.t)));
          x = prev.x + (k.x - prev.x) * q;
          if (k.hop) hopLift = Math.sin(q * Math.PI) * cell * 0.45;
        }
        break;
      }
    }
    /* pusher squishy (pig demo) */
    if (spec.pusher) {
      const q = easeOC(Math.min(1, Math.max(0, (t - 600) / 500)));
      SPR.squishy?.(ctx, {
        x: cxAt(-0.55 + q * 0.85), y: cy, cell, now,
        r: cell * 0.26, mood: 'happy', seed: 9, idle: q === 0 || q === 1
      });
    }
    /* gobbled by a nomster — the squishy is gone */
    if (spec.vanish !== undefined && t >= spec.vanish) return;
    const rot = spec.bumpTurn && t > 900 ? Math.min(1, (t - 900) / 300) * (Math.PI / 2) : 0;
    SPR[actorName]?.(ctx, {
      x: cxAt(x), y: cy - hopLift, cell, now,
      mood: zzz ? 'sleepy' : 'happy', seed: 4, idle: hopLift === 0, rot
    });
    if (zzz) {
      ctx.fillStyle = C.ink;
      ctx.font = '700 13px Fredoka, ui-rounded, system-ui';
      ctx.fillText('z z', cxAt(x) + cell * 0.3, cy - cell * 0.38);
    }
  };

  const loop = (now: number): void => {
    if (!current) return;
    drawPortrait(now);
    drawDemo(now);
    raf = requestAnimationFrame(loop);
  };

  const show = (spec: IntroSpec): void => {
    current = spec;
    openedAt = performance.now();
    elName.textContent = spec.name;
    elLine.textContent = spec.line;
    el.classList.add('show');
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    if (autoTimer !== null) clearTimeout(autoTimer);
    autoTimer = window.setTimeout(() => dismiss(), AUTO_MS);
  };

  const dismiss = (): void => {
    if (!current) return;
    markMet(current.kind === 'dot' ? 'star' : current.kind);
    const next = queue.shift();
    if (next) {
      show(next);
      return;
    }
    current = null;
    cancelAnimationFrame(raf);
    if (autoTimer !== null) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    el.classList.remove('show');
    if (s.mode === 'intro') s.mode = 'idle';
    onAllDismissed(); // re-arm hints / oh-no for the position under the card
  };

  return {
    maybeShow: (sess: Session): boolean => {
      const met = getMet();
      const specs = presentKinds(sess)
        .filter((k) => !met.has(k))
        .map((k) => INTRO_SPECS[k])
        .filter((sp): sp is IntroSpec => sp !== undefined);
      if (specs.length === 0) return false;
      queue = specs.slice(1);
      sess.mode = 'intro';
      show(specs[0] as IntroSpec);
      return true;
    },
    dismiss,
    isOpen: () => current !== null
  };
}
