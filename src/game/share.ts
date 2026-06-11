/* Daily share — the viral moment. Renders the daily's STARTING board as a
   cute postcard, shows a congrats modal on solve, and shares result + image
   via the Web Share API (clipboard text fallback). */
import { key, makeLevel } from '../engine/core';
import type { LevelDef } from '../engine/types';
import { C } from '../lib/palette';
import * as U from '../lib/draw';
import type { Dir4 } from '../lib/types';
import { FLD } from '../fields';
import { SPR } from '../sprites';
import type { Session } from './session';
import { toast } from './toast';

const CARD_W = 640;
const CARD_H = 780;
const SITE = 'https://squishy.franzai.com';

/** Paint the level's initial state — board, fields, friends — postcard style. */
export function renderBoardCard(def: LevelDef, date: string): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = CARD_W;
  cv.height = CARD_H;
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  const now = 1234; /* frozen moment — deterministic image */

  const bg = ctx.createRadialGradient(CARD_W / 2, -80, 60, CARD_W / 2, CARD_H, CARD_H);
  bg.addColorStop(0, '#FFFAFC');
  bg.addColorStop(0.45, '#FFEFF6');
  bg.addColorStop(1, '#FFE2EE');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.textAlign = 'center';
  ctx.fillStyle = C.heart;
  ctx.font = '800 52px ui-rounded, "Quicksand", system-ui, sans-serif';
  ctx.fillText('Squishy', CARD_W / 2, 78);
  ctx.fillStyle = C.ink;
  ctx.font = '800 24px ui-rounded, "Quicksand", system-ui, sans-serif';
  ctx.fillText('& Friends', CARD_W / 2, 106);
  ctx.fillStyle = '#C18BA8';
  ctx.font = '800 22px ui-rounded, "Quicksand", system-ui, sans-serif';
  ctx.fillText('Daily ' + date, CARD_W / 2, 146);

  const level = makeLevel(def);
  const n = Math.max(level.w, level.h);
  const boardPx = 520;
  const cell = Math.floor(boardPx / n);
  const ox = Math.floor((CARD_W - cell * level.w) / 2);
  const oy = 180 + Math.floor((boardPx - cell * level.h) / 2);

  ctx.save();
  ctx.shadowColor = 'rgba(240,120,160,0.28)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = C.panel;
  U.rrect(ctx, ox - 12, oy - 12, cell * level.w + 24, cell * level.h + 24, 26);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.panelLn;
  ctx.lineWidth = 2;
  U.rrect(ctx, ox - 12, oy - 12, cell * level.w + 24, cell * level.h + 24, 26);
  ctx.stroke();

  const px = (x: number): number => ox + (x + 0.5) * cell;
  const py = (y: number): number => oy + (y + 0.5) * cell;
  for (let x = 0; x < level.w; x++) {
    for (let y = 0; y < level.h; y++) {
      ctx.globalAlpha = (x + y) % 2 === 0 ? 0.55 : 0.9;
      ctx.fillStyle = (x + y) % 2 === 0 ? C.lattice : C.latticeAlt;
      U.rrect(ctx, ox + x * cell + 2.5, oy + y * cell + 2.5, cell - 5, cell - 5, cell * 0.18);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  const gs = level.initState;
  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      const k = key(x, y);
      const o = { px: px(x), py: py(y), cell, now, gx: x, gy: y };
      if (level.ice.has(k)) FLD.ice?.(ctx, o);
      if (level.noms.has(k)) SPR.nomster?.(ctx, { x: px(x), y: py(y), cell, now });
      if (gs.stars.has(k)) {
        SPR.star?.(ctx, { x: px(x), y: py(y), cell, now, r: cell * 0.26, seed: x * 5 + y, idle: false });
      }
      if (level.sticky.has(k)) FLD.honey?.(ctx, o);
      if (level.oneway.has(k)) FLD.oneway?.(ctx, { ...o, dir: level.oneway.get(k) as Dir4 });
      if (level.split.has(k)) FLD.sparkle?.(ctx, o);
      if (level.portal.has(k)) FLD.portal?.(ctx, o);
      if (level.turn.has(k)) FLD.turner?.(ctx, o);
      if (level.mush.has(k)) FLD.mushroom?.(ctx, o);
      if (level.breeze.has(k)) FLD.pinwheel?.(ctx, { ...o, dir: level.breeze.get(k) as Dir4 });
      if (level.jelly.has(k)) FLD.jelly?.(ctx, o);
      if (level.walls.has(k)) FLD.wall?.(ctx, o);
    }
  }
  FLD.heart?.(ctx, {
    px: px(level.tx), py: py(level.ty), cell, now,
    locked: gs.stars.size > 0
  });
  const cast: Array<[string, { x: number; y: number }[]]> = [
    ['box', gs.boxes], ['balloon', gs.balloons], ['snail', gs.snails],
    ['penguin', gs.penguins], ['bear', gs.bears], ['ghost', gs.ghosts],
    ['bunny', gs.bunnies], ['frog', gs.frogs], ['panda', gs.pandas],
    ['cat', gs.cats], ['chick', gs.chicks], ['pig', gs.pigs]
  ];
  for (const [kind, list] of cast) {
    for (const p of list) {
      SPR[kind]?.(ctx, { x: px(p.x), y: py(p.y), cell, now, mood: 'happy', seed: p.x * 7 + p.y, idle: false });
    }
  }
  for (const d of gs.dots) {
    SPR.squishy?.(ctx, {
      x: px(d.x), y: py(d.y), cell, now, r: cell * 0.3, mood: 'happy', seed: d.x * 7 + d.y * 13, idle: false
    });
  }

  ctx.fillStyle = C.heart;
  ctx.font = '800 26px ui-rounded, "Quicksand", system-ui, sans-serif';
  ctx.fillText('Can you solve it?', CARD_W / 2, CARD_H - 44);
  ctx.fillStyle = '#C18BA8';
  ctx.font = '800 20px ui-rounded, "Quicksand", system-ui, sans-serif';
  ctx.fillText('squishy.franzai.com', CARD_W / 2, CARD_H - 14);
  return cv;
}

function shareText(date: string, moves: number): string {
  return 'I solved the Squishy & Friends daily ' + date + ' in ' + moves +
    ' moves - can you beat that? ' + SITE;
}

async function shareDaily(def: LevelDef, date: string, moves: number): Promise<void> {
  const text = shareText(date, moves);
  const cv = renderBoardCard(def, date);
  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/png'));
  try {
    if (blob && navigator.canShare?.({ files: [new File([blob], 's.png', { type: 'image/png' })] })) {
      const file = new File([blob], 'squishy-daily-' + date + '.png', { type: 'image/png' });
      await navigator.share({ text, files: [file] });
      return;
    }
    if (navigator.share) {
      await navigator.share({ text, url: SITE });
      return;
    }
  } catch {
    /* user cancelled the share sheet — nothing to do */
    return;
  }
  await navigator.clipboard.writeText(text);
  toast('Copied! Paste it anywhere', { ms: 2200 });
}

export interface DailyWin {
  /** show the congrats modal for a solved daily */
  show: (s: Session, onContinue: () => void) => void;
  hide: () => void;
  isOpen: () => boolean;
}

export function createDailyWin(): DailyWin {
  const el = document.getElementById('dailyWin') as HTMLElement;
  const elMoves = document.getElementById('dwMoves') as HTMLElement;
  const elImg = document.getElementById('dwCard') as HTMLCanvasElement;
  let continueFn: (() => void) | null = null;

  document.getElementById('dwShare')?.addEventListener('click', () => {
    const d = el.dataset;
    if (d.def && d.date) {
      void shareDaily(JSON.parse(d.def) as LevelDef, d.date, Number(d.moves));
    }
  });
  document.getElementById('dwContinue')?.addEventListener('click', () => {
    const fn = continueFn;
    continueFn = null;
    el.classList.remove('show');
    fn?.();
  });

  return {
    show: (s: Session, onContinue: () => void): void => {
      if (s.play.kind !== 'daily') return;
      continueFn = onContinue;
      el.dataset.def = JSON.stringify(s.def);
      el.dataset.date = s.play.date;
      el.dataset.moves = String(s.moves);
      elMoves.textContent = 'Solved in ' + s.moves + ' moves';
      /* draw the postcard preview scaled into the modal canvas */
      const card = renderBoardCard(s.def, s.play.date);
      const scale = 220 / CARD_W;
      elImg.width = 220;
      elImg.height = Math.round(CARD_H * scale);
      const ctx = elImg.getContext('2d');
      if (ctx) ctx.drawImage(card, 0, 0, elImg.width, elImg.height);
      el.classList.add('show');
    },
    hide: (): void => {
      continueFn = null;
      el.classList.remove('show');
    },
    isOpen: () => el.classList.contains('show')
  };
}
