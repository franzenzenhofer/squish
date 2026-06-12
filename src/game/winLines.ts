/* Win-card flavour text — a pool of cute, on-brand lines per star tier, picked
   at random with an anti-repeat guard so the same line never shows twice in a
   row. Keyed by the hearts value the rating already computes (3 / 2 / 1). */

/* 3 hearts: par-or-better — pure celebration. */
const TIER3: readonly string[] = [
  'Squishy-tastic! ✨',
  'Perfectly squished!',
  'Heart goals 💖',
  'Flawless little hop!',
  'Sweet and tidy!',
  'Pure squishy magic ✨',
  'You nailed it!',
  'Soft-serve perfection 🍦',
  'Top-shelf squishing!',
  'Cuteness overload 💕'
];

/* 2 hearts: one over par — warm encouragement. */
const TIER2: readonly string[] = [
  'So close - lovely solve!',
  'Sweetly done!',
  'Almost perfect, almost!',
  'Nicely squished 💗',
  'Great hopping out there!',
  'A wiggle off perfect!',
  'Smooth little solve!',
  'You found the way 💞',
  'That was a cute one!',
  'Well hopped, friend!'
];

/* 1 heart: more than one over par — gentle, playful "uh-oh". */
const TIER1: readonly string[] = [
  'Uh-oh, a wobbly one!',
  'You got there - phew!',
  'A squishy scramble!',
  'Messy but lovely 💓',
  'Whew, what a journey!',
  'A few extra wiggles!',
  'Bumpy, but you made it!',
  'Squished... eventually!',
  'A scenic little route!',
  'Got there in the end 💖'
];

/* The big celebratory headline — dynamic so the win never feels canned. Any of
   these fits any solve (you got there!); the tier line below adds the nuance. */
const TITLES: readonly string[] = [
  'You did it!',
  'Hooray!',
  'Woohoo!',
  'Nailed it!',
  'You rock!',
  'Squish-cess!',
  'Well done!',
  'Bravo!',
  'Amazing!',
  'Yes yes yes!',
  'Solved it!',
  'Sweet win!'
];

let lastTitle: string | null = null;

/** Pick a fresh celebratory headline, never repeating the previous one. */
export function pickWinTitle(): string {
  const choices = TITLES.filter((t) => t !== lastTitle);
  const title = choices[Math.floor(Math.random() * choices.length)] ?? TITLES[0] ?? 'You did it!';
  lastTitle = title;
  return title;
}

function poolFor(hearts: number): readonly string[] {
  if (hearts >= 3) return TIER3;
  if (hearts === 2) return TIER2;
  return TIER1;
}

let lastLine: string | null = null;

/** Pick a fresh line for the tier, never repeating the previous one shown. */
export function pickWinLine(hearts: number): string {
  const pool = poolFor(hearts);
  const choices = pool.length > 1 ? pool.filter((l) => l !== lastLine) : pool;
  const line = choices[Math.floor(Math.random() * choices.length)] ?? pool[0] ?? '';
  lastLine = line;
  return line;
}
