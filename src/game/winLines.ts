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

/* Hinted win: the bulb helped — celebrate warmly, never scold. Asking for
   help is always okay; the empty hearts alone tell the rest. */
const HINTED: readonly string[] = [
  'Solved together - you and the bulb 💡',
  'Teamwork makes the dream work ✨',
  'A little help is totally okay 💕',
  'You found the way - high five!',
  'Hints are friends too 💡',
  'Lovely solve, helper and all 💖'
];

/* Zen mode: a big, ever-varied pool of pure kindness - no scores, no targets,
   no "almost", never a hint of judgement. Just warmth for the simple joy of
   getting a friend home. Picked with the same anti-repeat guard so it stays
   fresh win after win. */
const ZEN: readonly string[] = [
  'Home sweet home 💕',
  'A friend is safe and cosy now',
  'Lovely, gentle play ✨',
  'You made someone happy today',
  'Soft little win 💗',
  'That was a peaceful one',
  'Every friend, safely home',
  'Nicely, calmly done',
  'A warm little hug of a solve 🤗',
  'You took your time and it shows 💖',
  'Sweet as can be',
  'Pure cosy vibes ✨',
  'A heart full of squish 💞',
  'Beautifully unhurried',
  'No rush, just joy',
  'You found your way, friend',
  'Gentle hands, happy hearts 💕',
  'That felt good, didn\'t it?',
  'Snug and settled 🏡',
  'A kind little journey',
  'You and the squishies, together 💗',
  'Wander done, smile earned 😊',
  'Soft landings all around',
  'Quietly wonderful',
  'A cuddle of a solve 🧸',
  'Easy does it - lovely!',
  'Calm, cosy, complete',
  'You brought everyone home 💖',
  'Just lovely to watch ✨',
  'A breath of fresh squish',
  'Tucked in and content',
  'Sweet dreams are made of this 💤',
  'Warm fuzzies, all the way 💛',
  'Pure, gentle delight',
  'A little moment of calm',
  'You did that with love 💕',
  'Soft hearts win every time',
  'Cosy corner, happy friends 🏡',
  'However you got there, it\'s perfect',
  'Take a breath - you earned this smile'
];

let lastLine: string | null = null;

function pickFrom(pool: readonly string[]): string {
  const choices = pool.length > 1 ? pool.filter((l) => l !== lastLine) : pool;
  const line = choices[Math.floor(Math.random() * choices.length)] ?? pool[0] ?? '';
  lastLine = line;
  return line;
}

/** Pick a fresh line for the tier, never repeating the previous one shown. */
export function pickWinLine(hearts: number): string {
  return pickFrom(poolFor(hearts));
}

/** Pick a fresh hinted-win line (the no-hearts celebration). */
export function pickHintedLine(): string {
  return pickFrom(HINTED);
}

/** Pick a fresh Zen-mode line - kind words only, no score, no judgement. */
export function pickZenLine(): string {
  return pickFrom(ZEN);
}
