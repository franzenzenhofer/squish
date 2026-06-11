/* Shared option shapes every sprite and field module accepts. */
export type Dir4 = 'up' | 'down' | 'left' | 'right';

export type Mood =
  | 'happy' | 'joy' | 'sleepy' | 'dizzy' | 'wink' | 'look' | 'idle' | 'feed' | 'zzz'
  | 'worried';

export interface SpriteOpts {
  x: number;
  y: number;
  cell: number;
  now: number;
  /** body radius; sprites default to cell * 0.3 when omitted */
  r?: number;
  sx?: number;
  sy?: number;
  dx?: number;
  dy?: number;
  mood?: Mood;
  seed?: number;
  idle?: boolean;
  rot?: number;
  /** nomster only: scale pulse while chomping */
  chomp?: number;
}

export interface FieldOpts {
  px: number;
  py: number;
  cell: number;
  now: number;
  gx?: number;
  gy?: number;
  dir?: Dir4;
  won?: boolean;
  /** heart only: stars remain — render the cute steel padlock look */
  locked?: boolean;
  /** heart only: unlock animation progress 0..1 (band falls, pink blooms) */
  unlockP?: number;
}

export type SpriteFn = (ctx: CanvasRenderingContext2D, o: SpriteOpts) => void;
export type FieldFn = (ctx: CanvasRenderingContext2D, o: FieldOpts) => void;
