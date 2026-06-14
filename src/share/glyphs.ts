/* Glyph-table SSOT for the human-readable level share code. One glyph per
   board cell, row-major. Single-occupancy fields get one uppercase letter or
   digit; the two directional fields (oneway, breeze) use a base letter plus a
   lowercase direction suffix (a 2-char cell token). Empty cells are '0'.

   First letters collide across many fields, so glyphs are assigned
   deliberately (mnemonic where possible) and MUST stay unique. Everything that
   needs a glyph is defined here and nowhere else. */

export const EMPTY = '0';

/** field key on LevelDef -> single glyph. Covers single-occupancy cells. */
export const CELL_GLYPH: Record<string, string> = {
  target: 'M', // Mark / heart
  dots: 'D',
  walls: 'W',
  noms: 'N',
  sticky: 'K', // sticKy
  split: 'Y', // splitsY
  turn: 'T',
  ice: 'I',
  jelly: 'J',
  spring: 'G', // sprinG
  boxes: 'X', // boX
  balloons: 'O', // ballOon
  snails: 'L', // snaiL
  penguins: 'Q',
  bears: 'R', // beaR
  ghosts: 'H', // gHost
  bunnies: 'U', // bUnny
  frogs: 'F',
  pandas: 'A', // pAnda
  cats: 'C',
  chicks: 'E', // chick -> E
  pigs: 'P',
  stars: 'S',
  portalA: '1',
  portalB: '2'
};

/** glyph -> field key (reverse of CELL_GLYPH). */
export const GLYPH_CELL: Record<string, string> = Object.fromEntries(
  Object.entries(CELL_GLYPH).map(([field, g]) => [g, field])
);

/** directional field key -> base glyph (uppercase). */
export const DIR_BASE: Record<string, string> = {
  oneway: 'V',
  breeze: 'Z'
};

/** base glyph -> directional field key. */
export const BASE_DIR: Record<string, string> = Object.fromEntries(
  Object.entries(DIR_BASE).map(([field, g]) => [g, field])
);

/** DirCode -> lowercase suffix, and back. */
export const DIR_SUFFIX: Record<string, string> = { U: 'u', D: 'd', L: 'l', R: 'r' };
export const SUFFIX_DIR: Record<string, string> = Object.fromEntries(
  Object.entries(DIR_SUFFIX).map(([d, s]) => [s, d])
);
