/* Engine types — pure logic, no DOM. */

export type Dir = 'up' | 'down' | 'left' | 'right';
export type DirCode = 'U' | 'D' | 'L' | 'R';

export type MoverKind =
  | 'dot' | 'box' | 'balloon' | 'snail'
  | 'penguin' | 'bear' | 'ghost' | 'bunny' | 'frog'
  | 'panda' | 'cat' | 'chick' | 'pig';

export interface Pt {
  x: number;
  y: number;
}

export interface DotPt extends Pt {
  /** cosmetic mass from merges */
  m: number;
}

/** Friend piece arrays beyond the four classic movers. */
export const FRIEND_KEYS = [
  'penguins', 'bears', 'ghosts', 'bunnies', 'frogs',
  'pandas', 'cats', 'chicks', 'pigs'
] as const;
export type FriendKey = (typeof FRIEND_KEYS)[number];

export interface GameState {
  dots: DotPt[];
  boxes: Pt[];
  balloons: Pt[];
  snails: Pt[];
  penguins: Pt[];
  bears: Pt[];
  ghosts: Pt[];
  bunnies: Pt[];
  frogs: Pt[];
  pandas: Pt[];
  cats: Pt[];
  chicks: Pt[];
  pigs: Pt[];
  /** shattered ice cells (act as walls) */
  broken: Set<string>;
  /** fed / scared-away nomster cells (now plain floor) */
  fed: Set<string>;
  /** uncollected star cells — heart opens when empty */
  stars: Set<string>;
  /** flips on every effective swipe; panda moves when parity === 1 */
  parity: 0 | 1;
  /** direction of the previous effective swipe — chicks copy it */
  lastDir: Dir | null;
}

export type XY = [number, number];
export type XYDir = [number, number, DirCode];

/** JSON-friendly level definition (also the levels.json schema). */
export interface LevelDef {
  w: number;
  h: number;
  target: XY;
  dots: XY[];
  walls?: XY[];
  noms?: XY[];
  sticky?: XY[];
  split?: XY[];
  turn?: XY[];
  ice?: XY[];
  jelly?: XY[];
  spring?: XY[];
  oneway?: XYDir[];
  breeze?: XYDir[];
  portals?: [XY, XY];
  boxes?: XY[];
  balloons?: XY[];
  snails?: XY[];
  penguins?: XY[];
  bears?: XY[];
  ghosts?: XY[];
  bunnies?: XY[];
  frogs?: XY[];
  pandas?: XY[];
  cats?: XY[];
  chicks?: XY[];
  pigs?: XY[];
  stars?: XY[];
  par: number;
  sol?: string;
  cap?: string;
}

export interface Level {
  w: number;
  h: number;
  walls: Set<string>;
  noms: Set<string>;
  sticky: Set<string>;
  split: Set<string>;
  turn: Set<string>;
  ice: Set<string>;
  jelly: Set<string>;
  spring: Set<string>;
  oneway: Map<string, Dir>;
  breeze: Map<string, Dir>;
  portal: Map<string, Pt>;
  target: string;
  tx: number;
  ty: number;
  par: number;
  initState: GameState;
}

export interface PathStep extends Pt {
  /** teleported into this cell */
  tp?: boolean;
  /** hopped (jelly / bunny / froggy leap) into this cell */
  hop?: boolean;
}

export type FxType =
  | 'split' | 'crack' | 'beam' | 'turn' | 'bounce' | 'wind' | 'feed'
  | 'scare' | 'shove' | 'collect' | 'catturn' | 'hopfx';

export interface Fx {
  type: FxType;
  cell: Pt;
  /** path index at which the fx fires */
  idx: number;
  to?: Pt;
  m?: number;
}

export type MoveEnd = 'rest' | 'merge' | 'die' | 'feed';

export interface MoverReport {
  kind: MoverKind;
  m0: number;
  m: number;
  path: PathStep[];
  fx: Fx[];
  end: MoveEnd;
  stick: boolean;
  /** cells the triggering pusher travelled before a pig shove (animation delay) */
  delayCells?: number;
}

export interface MoveResult {
  state: GameState;
  movers: MoverReport[];
  moved: boolean;
}

export type SolveStatus = 'solved' | 'unsolvable' | 'unknown';

export interface SolveOptions {
  maxStates?: number;
  maxDepth?: number;
  /** wall-clock budget; checked between BFS depth layers */
  deadlineMs?: number;
}

export type SolveResult =
  | { status: 'solved'; par: number; ways: number; solution: Dir[] }
  | { status: 'unsolvable' }
  | { status: 'unknown' };
