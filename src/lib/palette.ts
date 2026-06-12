/* The one cohesive pastel palette for the whole world. Features use a soft
   plum, never pure black. Each creature has hi / base / lo / line / core
   tints so the shared plush() body shader can shade it consistently. */
export const C = {
  /* features */
  line: '#5A3247', pupil: '#46263A', pupilLo: '#2E1826', white: '#FFFFFF',
  ink: '#6B4A5B', tongue: '#FF93B6',

  /* squishy — strawberry cream */
  bibi: '#FFB0CC', bibiHi: '#FFE6F0', bibiLo: '#FB8DB5', bibiLn: '#E2658F', bibiCore: '#F578A6',
  blush: '#FF8FB4', sprout: '#FF6D9E',

  /* marshmallow box — vanilla cream */
  box: '#FFF1DE', boxHi: '#FFFCF7', boxLo: '#FFE0BE', boxLn: '#E3B987', boxCore: '#F4D4AC',

  /* balloon — peach */
  bal: '#FFB088', balHi: '#FFE7D6', balLo: '#FF8F5F', balLn: '#E96F3C', balCore: '#FF9E72',

  /* snail — pistachio body, honey shell */
  snail: '#BCEBA6', snailHi: '#E4F8D8', snailLo: '#93CE77', snailLn: '#6FB252', snailCore: '#A6DE8C',
  shell: '#FFC974', shellHi: '#FFEAC2', shellLo: '#F1AC4E', shellLn: '#D78C34',

  /* nomster — lilac */
  nom: '#C7A9F4', nomHi: '#E9DBFC', nomLo: '#A47EE6', nomLn: '#875ED4', nomCore: '#B595EE',
  nomMouth: '#6A3A6E',

  /* fields */
  honey: '#FFCE63', honeyHi: '#FFEBAE', honeyLo: '#F1B23F', honeyLn: '#E3A130',
  star: '#FF8FC2', starHi: '#FFE0EF', starLn: '#F263A6',
  portal: '#A6DBFF', portalHi: '#E8F6FF', portalLn: '#4FAAEC',
  curl: '#C4A9F8', curlHi: '#E5D8FC', curlLn: '#9676E6',
  ice: '#E7F4FC', iceHi: '#FFFFFF', iceLn: '#A8D6EF', frost: '#9CCEEC',
  shard: '#D2ECFB', shardHi: '#F0FAFF', shardLn: '#9CCEEC',
  spring: '#FF8C9B', springHi: '#FFB3BC', springLo: '#F06678', springLn: '#E25366', springStem: '#FFF4E8',
  jelly: '#FFAAD6', jellyHi: '#FFD3E8', jellyLn: '#F377B3',
  mint: '#A0E7CF', mintHi: '#D2F4E8', mintLn: '#54C09E',
  wall: '#D9CBF6', wallHi: '#F0E9FC', wallLo: '#C2B1EC', wallLn: '#AE94E3', wallBtn: '#C9B8F0',
  heart: '#FF6B9D', heartHi: '#FFB4CF', heartLn: '#F04F88',

  /* gold star pickup */
  goldStar: '#FFD56A', goldStarHi: '#FFF0C4', goldStarLn: '#E8AE32',

  /* locked heart — cute steel */
  steel: '#D6DCEA', steelHi: '#F4F7FC', steelLo: '#B9C3D9', steelLn: '#94A1BE',

  /* surfaces & accents */
  panel: '#FFFFFF', panelLn: '#FBE2EC', lattice: '#FBE6EE', latticeAlt: '#FFF8FB',
  yel: '#FFD56A', sky: '#FFE9F2'
} as const;

/* candy balloon themes — picked by seed so a level's balloons vary happily */
export interface BalloonTheme {
  hi: string;
  base: string;
  lo: string;
  line: string;
}

export const BAL_THEMES: readonly BalloonTheme[] = [
  { hi: '#FFE7D6', base: '#FFB088', lo: '#FF8F5F', line: '#E96F3C' }, /* peach */
  { hi: '#E8F6FF', base: '#A6DBFF', lo: '#6FBFF2', line: '#4FAAEC' }, /* sky */
  { hi: '#D2F4E8', base: '#A0E7CF', lo: '#6FD0AC', line: '#54C09E' }, /* mint */
  { hi: '#FFF0C4', base: '#FFD56A', lo: '#F4BD45', line: '#E8AE32' }, /* lemon */
  { hi: '#E5D8FC', base: '#C4A9F8', lo: '#A685EC', line: '#9676E6' }  /* lavender */
];
