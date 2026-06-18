/* Debug test levels — hand-authored edge cases, visible in the level picker
   only with ?debug=doit. Every def is solver-verified by tests/debug-levels
   (sol replays to a win, oracle exhausts, the trap level really has proven
   dead opening swipes). The two combo boards were baked by the real generator
   and pasted, so they are exactly what the pipeline can produce. */
import type { LevelDef } from '../engine/types';

export interface DebugLevel {
  /** short picker label */
  name: string;
  /** which edge the level exercises */
  why: string;
  def: LevelDef;
}

export const DEBUG_LEVELS: readonly DebugLevel[] = [
  {
    name: 'Oh-no trap',
    why: 'every effective swipe except the winning one lands in a PROVEN dead state - the jump-back must fire each time',
    def: { w: 3, h: 3, target: [1, 1], dots: [[0, 1]], walls: [[2, 1]], par: 1, sol: 'R' }
  },
  {
    name: 'Nomster chomp',
    why: 'one swipe feeds the only squishy to the nomster - the lose path',
    def: { w: 3, h: 3, target: [0, 0], dots: [[0, 1]], noms: [[2, 1]], par: 1, sol: 'U' }
  },
  {
    name: 'Win in one',
    why: 'instant win - the fastest path through every win-flow setting',
    def: { w: 4, h: 4, target: [3, 3], dots: [[0, 3]], par: 1, sol: 'R' }
  },
  {
    name: 'Star gate',
    why: 'the heart stays locked until the star is collected',
    def: { w: 4, h: 4, target: [3, 0], dots: [[0, 2]], stars: [[3, 2]], par: 2, sol: 'RU' }
  },
  {
    name: 'Twin portal',
    why: 'splitter twin + portal beam in one line - merge ordering',
    def: {
      w: 5, h: 5, target: [4, 4], dots: [[0, 0]], split: [[2, 0]],
      portals: [[4, 0], [0, 4]], walls: [[4, 3]], par: 2, sol: 'RR'
    }
  },
  {
    name: 'Flower stop',
    why: 'sticky flower mid-run; two openings are dead - oh-no on a fields board',
    def: { w: 5, h: 5, target: [4, 2], dots: [[0, 2]], sticky: [[2, 2]], ice: [[2, 4]], par: 2, sol: 'RR' }
  },
  {
    name: 'Combo stress',
    why: 'friends + nomster + splitters + stars at par 12 - the hard-combo shape (generator-baked)',
    def: {
      w: 6, h: 6, target: [3, 0], dots: [[5, 1], [5, 2]], par: 12,
      walls: [[1, 0], [2, 2], [4, 5], [5, 0], [1, 1], [2, 5]],
      noms: [[4, 3]], split: [[0, 1], [2, 4]], stars: [[0, 2], [2, 3]],
      frogs: [[0, 0]], chicks: [[5, 4]], sol: 'DDLULDDRURLU'
    }
  },
  {
    name: 'Panda & chick',
    why: 'the two state-space-heaviest friends together - oracle budget edge (generator-baked)',
    def: {
      w: 5, h: 5, target: [3, 0], dots: [[3, 4], [0, 3]], par: 9,
      walls: [[1, 3], [0, 0], [4, 4], [3, 3]], split: [[4, 1]],
      ice: [[2, 0], [0, 1], [1, 1]], pandas: [[0, 4]], chicks: [[2, 3]],
      sol: 'UDLLURUUL'
    }
  }
];
