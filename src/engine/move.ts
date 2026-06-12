/* Move resolution — one swipe moves every movable at once.
   Pass 1: dots, boxes, snails, penguins, bears, ghosts, bunnies, frogs,
           cats and awake pandas — front-most-first along the swipe.
   Pass 1.5: chicks copy the PREVIOUS swipe direction (phantom pre-seeded).
   Pass 2: balloons drift the opposite way (phantom pre-seeded).
   Pigs never run: they sit solid and get shoved at most one cell per swipe.
   Direction changes are capped per mover per swipe; a guard counter backs
   every loop so all paths are finite. */
import { DIRS, REV, ROTCW, key } from './core';
import type {
  Dir, Fx, GameState, Level, MoveEnd, MoveResult, MoverKind, MoverReport, PathStep, Pt
} from './types';

interface Settled extends Pt {
  kind: MoverKind;
  m: number;
  phantom?: boolean;
  shoved?: boolean;
}

interface Runner extends Pt {
  kind: MoverKind;
  m: number;
  m0: number;
}

interface PigRecord {
  path: PathStep[];
  fx: Fx[];
  end: MoveEnd;
  delayCells: number;
}

/** main-loop step budget per kind (cells for sliders, leaps for froggy) */
function budgetOf(kind: MoverKind): number {
  if (kind === 'snail') return 1;
  if (kind === 'bear') return 2;
  if (kind === 'frog') return 3;
  return Infinity;
}

function frontMostFirst(movers: Runner[], d: Dir): Runner[] {
  const [dx, dy] = DIRS[d];
  return movers.sort((a, b) => (dx !== 0 ? (b.x - a.x) * dx : (b.y - a.y) * dy));
}

export function move(level: Level, state: GameState, dir: Dir): MoveResult {
  const settled = new Map<string, Settled>();
  const broken = new Set(state.broken);
  const fed = new Set(state.fed);
  const stars = new Set(state.stars);
  const out: MoverReport[] = [];
  const pigRecords = new Map<string, PigRecord>();
  let moved = false;

  const pandaAwake = state.parity === 1;

  /* ---- pre-seeding: pieces that block before (or instead of) running ---- */
  for (const b of state.balloons) {
    settled.set(key(b.x, b.y), { kind: 'balloon', m: 1, x: b.x, y: b.y, phantom: true });
  }
  for (const c of state.chicks) {
    settled.set(key(c.x, c.y), { kind: 'chick', m: 1, x: c.x, y: c.y, phantom: true });
  }
  for (const p of state.pigs) {
    settled.set(key(p.x, p.y), { kind: 'pig', m: 1, x: p.x, y: p.y });
    pigRecords.set(key(p.x, p.y), {
      path: [{ x: p.x, y: p.y }], fx: [], end: 'rest', delayCells: 0
    });
  }
  if (!pandaAwake) {
    for (const p of state.pandas) {
      settled.set(key(p.x, p.y), { kind: 'panda', m: 1, x: p.x, y: p.y });
      out.push({
        kind: 'panda', m0: 1, m: 1, path: [{ x: p.x, y: p.y }], fx: [], end: 'rest', stick: false
      });
    }
  }

  const isWallLike = (k: string): boolean => level.walls.has(k) || broken.has(k);
  const isNom = (k: string): boolean => level.noms.has(k) && !fed.has(k);
  const inBounds = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < level.w && y < level.h;

  /** Shove a pig from `pk` one cell in direction d. Returns what the pusher
      may do next: 'enter' the vacated cell, 'blocked' (no shove possible) or
      'cracked' (pig left intact ice — the fresh shard pile blocks entry). */
  function tryShove(pk: string, pig: Settled, d: Dir, delayCells: number): 'enter' | 'blocked' | 'cracked' {
    if (pig.shoved) return 'blocked';
    const tx = pig.x + DIRS[d][0];
    const ty = pig.y + DIRS[d][1];
    if (!inBounds(tx, ty)) return 'blocked';
    const tk = key(tx, ty);
    if (isWallLike(tk)) return 'blocked';
    const ow = level.oneway.get(tk);
    if (ow !== undefined && ow !== d) return 'blocked';
    if (settled.has(tk)) return 'blocked';
    const rec = pigRecords.get(key(pig.x, pig.y));
    if (!rec) return 'blocked';
    settled.delete(pk);
    moved = true;
    rec.delayCells = delayCells;
    if (level.ice.has(pk) && !broken.has(pk)) {
      broken.add(pk);
      rec.fx.push({ type: 'crack', cell: { x: pig.x, y: pig.y }, idx: 0 });
    }
    if (isNom(tk)) {
      fed.add(tk);
      rec.path.push({ x: tx, y: ty });
      rec.fx.push({ type: 'feed', cell: { x: tx, y: ty }, idx: 1 });
      rec.end = 'feed';
      pigRecords.delete(pk);
      pigRecords.set(tk + '!fed', rec);
    } else {
      settled.set(tk, { kind: 'pig', m: 1, x: tx, y: ty, shoved: true });
      rec.path.push({ x: tx, y: ty });
      pigRecords.delete(pk);
      pigRecords.set(tk, rec);
    }
    return broken.has(pk) ? 'cracked' : 'enter';
  }

  function runMover(M: Runner, d0: Dir): void {
    let d = d0;
    let cur: Pt = { x: M.x, y: M.y };
    const path: PathStep[] = [{ x: cur.x, y: cur.y }];
    const fx: Fx[] = [];
    const entered = new Set<string>();
    let usedTp = false, usedTurn = false, usedBounce = false, usedWind = false;
    let usedCatTurn = false;
    let end: MoveEnd | null = null;
    let stick = false;
    let steps = 0;
    const budget = budgetOf(M.kind);
    let guard = 6 * level.w * level.h + 16;
    const ghost = M.kind === 'ghost';

    /** Leaving a cell: shatter intact ice (not penguins/ghosts gliding);
        drop a splitter clone if a dot passed through. */
    function leaveCell(c: Pt): void {
      const ck = key(c.x, c.y);
      if (level.ice.has(ck) && !broken.has(ck) && M.kind !== 'penguin' && !ghost) {
        broken.add(ck);
        fx.push({ type: 'crack', cell: { x: c.x, y: c.y }, idx: path.length - 1 });
      }
      if (M.kind === 'dot' && level.split.has(ck) && entered.has(ck) && !settled.has(ck)) {
        const cm = Math.max(1, Math.floor(M.m / 2));
        M.m = Math.max(1, Math.ceil(M.m / 2));
        settled.set(ck, { kind: 'dot', m: cm, x: c.x, y: c.y });
        fx.push({ type: 'split', cell: { x: c.x, y: c.y }, idx: path.length - 1, m: cm });
      }
    }

    /** Cell-entry pipeline; loops while effects relocate the mover. */
    function enterAt(): 'continue' | 'rest' | 'die' | 'feed' | 'merge' {
      for (let iter = 0; iter < 8; iter++) {
        const k = key(cur.x, cur.y);
        if (M.kind === 'dot' && stars.has(k)) {
          stars.delete(k);
          fx.push({ type: 'collect', cell: { x: cur.x, y: cur.y }, idx: path.length - 1 });
        }
        if (isNom(k)) {
          if (M.kind === 'box' || M.kind === 'balloon') {
            fed.add(k);
            fx.push({ type: 'feed', cell: { x: cur.x, y: cur.y }, idx: path.length - 1 });
            return 'feed';
          }
          return 'die';
        }
        if (level.sticky.has(k)) {
          stick = true;
          return 'rest';
        }
        if (level.portal.has(k) && !usedTp) {
          const dest = level.portal.get(k) as Pt;
          const dk = key(dest.x, dest.y);
          if (!settled.has(dk) && !isWallLike(dk)) {
            usedTp = true;
            leaveCell(cur);
            fx.push({
              type: 'beam', cell: { x: cur.x, y: cur.y },
              to: { x: dest.x, y: dest.y }, idx: path.length - 1
            });
            cur = { x: dest.x, y: dest.y };
            path.push({ x: dest.x, y: dest.y, tp: true });
            entered.add(dk);
            continue;
          }
        }
        if (level.jelly.has(k)) {
          const lx = cur.x + 2 * DIRS[d][0];
          const ly = cur.y + 2 * DIRS[d][1];
          if (inBounds(lx, ly)) {
            const lk = key(lx, ly);
            const landOcc = settled.get(lk);
            const ow = level.oneway.get(lk);
            const enterOk = !isWallLike(lk) && (ow === undefined || ow === d);
            if (enterOk && (!landOcc || (landOcc.kind === 'dot' && M.kind === 'dot' && !landOcc.phantom))) {
              leaveCell(cur);
              if (landOcc) {
                landOcc.m += M.m;
                path.push({ x: lx, y: ly, hop: true });
                return 'merge';
              }
              cur = { x: lx, y: ly };
              path.push({ x: lx, y: ly, hop: true });
              entered.add(lk);
              continue;
            }
          }
        }
        if (level.turn.has(k) && !usedTurn) {
          usedTurn = true;
          d = ROTCW[d];
          fx.push({ type: 'turn', cell: { x: cur.x, y: cur.y }, idx: path.length - 1 });
        } else if (level.spring.has(k) && !usedBounce) {
          usedBounce = true;
          d = REV[d];
          fx.push({ type: 'bounce', cell: { x: cur.x, y: cur.y }, idx: path.length - 1 });
        } else if (level.breeze.has(k) && !usedWind) {
          usedWind = true;
          d = level.breeze.get(k) as Dir;
          fx.push({ type: 'wind', cell: { x: cur.x, y: cur.y }, idx: path.length - 1 });
        }
        return 'continue';
      }
      return 'rest';
    }

    /** Blocked in front: kitty turns clockwise once instead of stopping. */
    function blockedAhead(): 'turned' | 'rest' {
      if (M.kind === 'cat' && !usedCatTurn) {
        usedCatTurn = true;
        d = ROTCW[d];
        fx.push({ type: 'catturn', cell: { x: cur.x, y: cur.y }, idx: path.length - 1 });
        return 'turned';
      }
      return 'rest';
    }

    /** Froggy: scan to just before the first blocker (edge, wall, piece,
        wrong-way candy arrow); returns leap distance in cells (0 = blocked). */
    function leapDistance(): number {
      let i = 1;
      for (;;) {
        const lx = cur.x + i * DIRS[d][0];
        const ly = cur.y + i * DIRS[d][1];
        if (!inBounds(lx, ly)) return i - 1;
        const lk = key(lx, ly);
        const ow = level.oneway.get(lk);
        if (isWallLike(lk) || settled.has(lk) || (ow !== undefined && ow !== d)) return i - 1;
        i++;
      }
    }

    while (guard-- > 0) {
      if (steps >= budget) { end = 'rest'; break; }

      if (M.kind === 'frog') {
        const dist = leapDistance();
        if (dist === 0) {
          if (blockedAhead() === 'turned') continue;
          end = 'rest';
          break;
        }
        leaveCell(cur);
        cur = { x: cur.x + dist * DIRS[d][0], y: cur.y + dist * DIRS[d][1] };
        path.push({ x: cur.x, y: cur.y, hop: true });
        entered.add(key(cur.x, cur.y));
        steps++;
        const act = enterAt();
        /* a redirect at the landing lets froggy leap again (budget caps it);
           with no redirect the next scan finds distance 0 and he rests */
        if (act === 'continue') continue;
        if (act === 'rest') { end = 'rest'; break; }
        end = act;
        break;
      }

      const stepLen = M.kind === 'bunny' ? 2 : 1;
      const nx = cur.x + stepLen * DIRS[d][0];
      const ny = cur.y + stepLen * DIRS[d][1];
      if (!inBounds(nx, ny)) {
        if (blockedAhead() === 'turned') continue;
        end = 'rest';
        break;
      }
      const k = key(nx, ny);
      if (!ghost && isWallLike(k)) {
        if (blockedAhead() === 'turned') continue;
        end = 'rest';
        break;
      }
      const ow = level.oneway.get(k);
      if (!ghost && ow !== undefined && ow !== d) {
        if (blockedAhead() === 'turned') continue;
        end = 'rest';
        break;
      }
      if (!ghost && M.kind === 'bear' && isNom(k)) {
        fed.add(k);
        fx.push({ type: 'scare', cell: { x: nx, y: ny }, idx: path.length - 1 });
        end = 'rest';
        break;
      }
      const occ = settled.get(k);
      if (occ) {
        if (M.kind === 'dot' && occ.kind === 'dot' && !occ.phantom) {
          leaveCell(cur);
          occ.m += M.m;
          path.push({ x: nx, y: ny });
          end = 'merge';
          break;
        }
        if (occ.kind === 'pig' && M.kind !== 'bunny') {
          const res = tryShove(k, occ, d, path.length - 1);
          if (res !== 'blocked') {
            fx.push({ type: 'shove', cell: { x: nx, y: ny }, idx: path.length - 1 });
            if (res === 'enter') {
              leaveCell(cur);
              cur = { x: nx, y: ny };
              path.push({ x: nx, y: ny });
            }
            end = 'rest';
            break;
          }
        }
        if (blockedAhead() === 'turned') continue;
        end = 'rest';
        break;
      }
      leaveCell(cur);
      cur = { x: nx, y: ny };
      path.push(stepLen === 2 ? { x: nx, y: ny, hop: true } : { x: nx, y: ny });
      entered.add(k);
      steps++;
      if (ghost) continue;
      const act = enterAt();
      if (act === 'continue') continue;
      if (act === 'rest') { end = 'rest'; break; }
      end = act;
      break;
    }

    if (end === null) end = 'rest';
    if (end === 'rest') {
      settled.set(key(cur.x, cur.y), { kind: M.kind, m: M.m, x: cur.x, y: cur.y });
    }
    if (path.length > 1 || fx.length > 0) moved = true;
    out.push({ kind: M.kind, m0: M.m0, m: M.m, path, fx, end, stick });
  }

  /* ---- pass 1 ----------------------------------------------------------- */
  const p1: Runner[] = [];
  const push = (kind: MoverKind, list: Pt[]): void => {
    for (const p of list) p1.push({ kind, x: p.x, y: p.y, m: 1, m0: 1 });
  };
  for (const p of state.dots) p1.push({ kind: 'dot', x: p.x, y: p.y, m: p.m, m0: p.m });
  push('box', state.boxes);
  push('snail', state.snails);
  push('penguin', state.penguins);
  push('bear', state.bears);
  push('ghost', state.ghosts);
  push('bunny', state.bunnies);
  push('frog', state.frogs);
  push('cat', state.cats);
  if (pandaAwake) push('panda', state.pandas);
  frontMostFirst(p1, dir);
  for (const M of p1) runMover(M, dir);

  /* ---- pass 1.5: chicks copy the previous swipe ------------------------- */
  const lastDir = state.lastDir;
  if (state.chicks.length > 0) {
    if (lastDir === null) {
      for (const c of state.chicks) {
        settled.delete(key(c.x, c.y));
        settled.set(key(c.x, c.y), { kind: 'chick', m: 1, x: c.x, y: c.y });
        out.push({
          kind: 'chick', m0: 1, m: 1, path: [{ x: c.x, y: c.y }], fx: [], end: 'rest', stick: false
        });
      }
    } else {
      const pc: Runner[] = state.chicks.map((p) => ({ kind: 'chick', x: p.x, y: p.y, m: 1, m0: 1 }));
      frontMostFirst(pc, lastDir);
      for (const M of pc) {
        settled.delete(key(M.x, M.y));
        runMover(M, lastDir);
      }
    }
  }

  /* ---- pass 2: balloons drift the opposite way -------------------------- */
  const bdir = REV[dir];
  const p2: Runner[] = state.balloons.map((p) => ({ kind: 'balloon', x: p.x, y: p.y, m: 1, m0: 1 }));
  frontMostFirst(p2, bdir);
  for (const M of p2) {
    settled.delete(key(M.x, M.y));
    runMover(M, bdir);
  }

  /* ---- pig reports ------------------------------------------------------- */
  for (const rec of pigRecords.values()) {
    out.push({
      kind: 'pig', m0: 1, m: 1, path: rec.path, fx: rec.fx, end: rec.end,
      stick: false, delayCells: rec.delayCells
    });
  }

  /* ---- collect the new state --------------------------------------------- */
  const next: GameState = {
    dots: [], boxes: [], balloons: [], snails: [],
    penguins: [], bears: [], ghosts: [], bunnies: [], frogs: [],
    pandas: [], cats: [], chicks: [], pigs: [],
    broken, fed, stars,
    parity: state.parity,
    lastDir: state.lastDir
  };
  for (const v of settled.values()) {
    if (v.kind === 'dot') next.dots.push({ x: v.x, y: v.y, m: v.m });
    else if (v.kind === 'box') next.boxes.push({ x: v.x, y: v.y });
    else if (v.kind === 'balloon') next.balloons.push({ x: v.x, y: v.y });
    else if (v.kind === 'snail') next.snails.push({ x: v.x, y: v.y });
    else if (v.kind === 'penguin') next.penguins.push({ x: v.x, y: v.y });
    else if (v.kind === 'bear') next.bears.push({ x: v.x, y: v.y });
    else if (v.kind === 'ghost') next.ghosts.push({ x: v.x, y: v.y });
    else if (v.kind === 'bunny') next.bunnies.push({ x: v.x, y: v.y });
    else if (v.kind === 'frog') next.frogs.push({ x: v.x, y: v.y });
    else if (v.kind === 'panda') next.pandas.push({ x: v.x, y: v.y });
    else if (v.kind === 'cat') next.cats.push({ x: v.x, y: v.y });
    else if (v.kind === 'chick') next.chicks.push({ x: v.x, y: v.y });
    else next.pigs.push({ x: v.x, y: v.y });
  }
  if (moved) {
    next.parity = state.parity === 0 ? 1 : 0;
    next.lastDir = dir;
  }
  return { state: next, movers: out, moved };
}
