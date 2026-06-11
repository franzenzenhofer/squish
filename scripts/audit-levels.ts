/* Trap-density audit over all curated levels: full state-graph stats per
   level so difficulty cliffs and punishing boards are visible at a glance.
   Usage: npm run levels:audit */
import { analyzeLevel, winnableState } from '../src/engine/analyze';
import { DIRNAMES, cloneState, makeLevel, ser } from '../src/engine/core';
import { move } from '../src/engine/move';
import type { GameState, LevelDef } from '../src/engine/types';
import levels from '../src/levels.json';

interface Row {
  n: number;
  size: string;
  par: number;
  states: number;
  dead: number;
  deadPct: number;
  trapEdges: number;
  edges: number;
  trapPct: number;
  near3: number;
  maxDist: number;
}

const rows: Row[] = [];
for (let i = 0; i < (levels as LevelDef[]).length; i++) {
  const def = (levels as LevelDef[])[i] as LevelDef;
  const level = makeLevel(def);
  const oracle = analyzeLevel(level);
  if (!oracle.exhausted) throw new Error('level ' + (i + 1) + ': oracle not exhausted');
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

  rows.push({
    n: i + 1,
    size: def.w + 'x' + def.h,
    par: def.par,
    states: oracle.states,
    dead,
    deadPct: Math.round((dead / oracle.states) * 1000) / 10,
    trapEdges,
    edges,
    trapPct: Math.round((trapEdges / Math.max(1, edges)) * 1000) / 10,
    near3,
    maxDist
  });
}

console.log('lvl  size  par states   dead  dead%  trapE  edges  trap%  near3 maxD');
for (const r of rows) {
  console.log(
    String(r.n).padStart(3), r.size.padStart(5), String(r.par).padStart(4),
    String(r.states).padStart(6), String(r.dead).padStart(6),
    String(r.deadPct).padStart(6), String(r.trapEdges).padStart(6),
    String(r.edges).padStart(6), String(r.trapPct).padStart(6),
    String(r.near3).padStart(6), String(r.maxDist).padStart(4)
  );
}
const worst = [...rows].sort((a, b) => b.trapPct - a.trapPct).slice(0, 5);
console.log('\nhighest trap density:', worst.map((r) => 'L' + r.n + ' (' + r.trapPct + '%)').join(', '));
const punishing = rows.filter((r) => r.near3 > 0);
console.log('levels with dead states within 3 swipes:',
  punishing.length ? punishing.map((r) => 'L' + r.n + ' (' + r.near3 + ')').join(', ') : 'none');
