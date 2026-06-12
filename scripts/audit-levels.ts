/* Trap-density + difficulty audit over the curated levels (and, with GEN=1,
   the generated 41-50): full state-graph stats per level so difficulty cliffs
   and punishing boards are visible at a glance. Usage: npm run levels:audit

   WHAT "HARDER" MEANS (the curve contract):
   - primary: par - the optimal solution length the player must find
   - secondary: mechanics load - distinct friend/field/classic groups on the
     board - and board size (search-space breadth)
   - hardness score = par*10 + mechanics*2 + (w-5)*3
   - guards, NOT difficulty: trapFree / near3=0 - hard levels must still be
     SOFT (no punishment in the opening swipes)
   The report flags any level whose par drops more than 2 below its
   predecessor (a cliff the player feels as "suddenly easier"). */
import { analyzeLevel, winnableState } from '../src/engine/analyze';
import { DIRNAMES, cloneState, makeLevel, ser } from '../src/engine/core';
import { move } from '../src/engine/move';
import { generateLevel, noAboveHeart } from '../src/gen/generate';
import { FRIEND_KEYS } from '../src/engine/types';
import type { GameState, LevelDef } from '../src/engine/types';
import levels from '../src/levels.json';

interface Row {
  n: number;
  size: string;
  par: number;
  mech: number;
  hard: number;
  states: number;
  dead: number;
  deadPct: number;
  trapEdges: number;
  edges: number;
  trapPct: number;
  near3: number;
  maxDist: number;
}

/** Distinct mechanic groups on the board (friends + classics + fields). */
function mechanics(def: LevelDef): number {
  const rec = def as unknown as Record<string, unknown[]>;
  const groups = [
    ...FRIEND_KEYS, 'boxes', 'balloons', 'snails',
    'noms', 'sticky', 'split', 'turn', 'ice', 'jelly', 'mush',
    'oneway', 'breeze', 'portals', 'stars'
  ];
  return groups.filter((k) => Array.isArray(rec[k]) && rec[k].length > 0).length;
}

function auditRow(n: number, def: LevelDef): Row {
  const level = makeLevel(def);
  const oracle = analyzeLevel(level);
  if (!oracle.exhausted) throw new Error('level ' + n + ': oracle not exhausted');
  let dead = 0;
  let maxDist = 0;
  for (const [k] of oracle.policy) {
    if (winnableState(oracle, k) === false) dead++;
  }
  for (const d of oracle.dist.values()) maxDist = Math.max(maxDist, d);

  /* walk the winnable subgraph: count edges that fall into dead states,
     and dead states reachable within 3 swipes of the start */
  let trapEdges = 0;
  let edges = 0;
  let near3 = 0;
  const seen = new Set<string>([ser(level.initState)]);
  const nearDead = new Set<string>();
  let frontier: GameState[] = [cloneState(level.initState)];
  let depth = 0;
  while (frontier.length > 0) {
    depth++;
    const next: GameState[] = [];
    for (const st of frontier) {
      if (winnableState(oracle, ser(st)) === false) continue; // don't expand dead
      for (const dir of DIRNAMES) {
        const r = move(level, st, dir);
        if (!r.moved) continue;
        edges++;
        const lost = r.state.dots.length === 0;
        const k = lost ? '' : ser(r.state);
        const isDead = lost || winnableState(oracle, k) === false;
        if (isDead) {
          trapEdges++;
          if (depth <= 3 && !lost && !nearDead.has(k)) {
            nearDead.add(k);
            near3++;
          }
        }
        if (lost || seen.has(k)) continue;
        seen.add(k);
        next.push(r.state);
      }
    }
    frontier = next;
  }

  const mech = mechanics(def);
  return {
    n,
    size: def.w + 'x' + def.h,
    par: def.par,
    mech,
    hard: def.par * 10 + mech * 2 + (def.w - 5) * 3,
    states: oracle.states,
    dead,
    deadPct: Math.round((dead / oracle.states) * 1000) / 10,
    trapEdges,
    edges,
    trapPct: Math.round((trapEdges / Math.max(1, edges)) * 1000) / 10,
    near3,
    maxDist
  };
}

const rows: Row[] = [];
const aboveHeart: number[] = [];
for (let i = 0; i < (levels as LevelDef[]).length; i++) {
  const def = (levels as LevelDef[])[i] as LevelDef;
  if (!noAboveHeart(def)) aboveHeart.push(i + 1);
  rows.push(auditRow(i + 1, def));
}

/* GEN=1: also audit the generated 41-50 (the debug picker's extra ladder) */
const genRows: Row[] = [];
if (process.env.GEN === '1') {
  for (let n = 41; n <= 50; n++) {
    genRows.push(auditRow(n, generateLevel(n)));
  }
}

function printTable(rs: Row[]): void {
  console.log('lvl  size  par mech  hard states   dead  dead%  trapE  edges  trap%  near3 maxD');
  for (const r of rs) {
    console.log(
      String(r.n).padStart(3), r.size.padStart(5), String(r.par).padStart(4),
      String(r.mech).padStart(4), String(r.hard).padStart(5),
      String(r.states).padStart(6), String(r.dead).padStart(6),
      String(r.deadPct).padStart(6), String(r.trapEdges).padStart(6),
      String(r.edges).padStart(6), String(r.trapPct).padStart(6),
      String(r.near3).padStart(6), String(r.maxDist).padStart(4)
    );
  }
}

printTable(rows);
if (genRows.length > 0) {
  console.log('\ngenerated 41-50:');
  printTable(genRows);
}

const worst = [...rows].sort((a, b) => b.trapPct - a.trapPct).slice(0, 5);
console.log('\nhighest trap density:', worst.map((r) => 'L' + r.n + ' (' + r.trapPct + '%)').join(', '));
const punishing = rows.filter((r) => r.near3 > 0);
console.log('levels with dead states within 3 swipes:',
  punishing.length ? punishing.map((r) => 'L' + r.n + ' (' + r.near3 + ')').join(', ') : 'none');

/* curve contract: within a section, par must never drop more than 2 below
   the previous level — a bigger drop reads as "suddenly easier". Sections:
   the curated late game (26-40, the combo arc) and the generated 41+ ladder
   (its own journey — the campaign finale is a deliberate climax before it).
   1-25 are the grandfathered hand-tuned intro arc (Franz: keep them). */
function dipCheck(label: string, rs: Row[]): void {
  const dips: string[] = [];
  for (let i = 1; i < rs.length; i++) {
    const prev = rs[i - 1] as Row;
    const cur = rs[i] as Row;
    if (cur.par < prev.par - 2) dips.push('L' + cur.n + ' (par ' + prev.par + '→' + cur.par + ')');
  }
  console.log('difficulty dips in ' + label + ' (par drop > 2):',
    dips.length ? dips.join(', ') : 'none');
}
dipCheck('curated 26-40', rows.filter((r) => r.n >= 26));
if (genRows.length > 0) dipCheck('generated 41+', genRows);

/* The original curated set is grandfathered (Franz, 2026-06-12: the originals
   play better - keep them). The no-actor-above-heart rule is enforced at
   GENERATION time (tryGenerate) for every new, daily and endless level, so this
   is informational for the curated set, not a failure. */
console.log('actors above the heart (curated, grandfathered):',
  aboveHeart.length ? aboveHeart.map((n) => 'L' + n).join(', ') : 'none');
