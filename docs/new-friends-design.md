# New Friends - movement archetypes the game is missing

Design note (no game-code change yet). Researched against the real step resolver
`src/engine/move.ts`, the schema in `src/engine/types.ts`, and the BFS in
`src/engine/solve.ts`. Date: 2026-06-14.

## Complete mover roster (today)

Every piece, by what it actually does in `move.ts`. "Full slide" = runs until a wall,
edge, or piece. Friend keys live in `FRIEND_KEYS`; dot/box/balloon/snail are the
classic movers.

| Mover | Direction vs swipe | Distance | Special |
|---|---|---|---|
| **Dot** (squishy) | same | full slide | merges with dots, lands on hearts/stars |
| **Box** | same | full slide | inert block, no merge |
| **Balloon** | opposite (`REV[dir]`) | full slide | drifts against the swipe |
| **Snail** | same | **1 cell** | the slow one-step walker |
| **Penguin** | same | full slide | glides over ice (never cracks it) |
| **Bear** | same | **max 2 cells** | scares nomsters before entering |
| **Ghost** | same | full slide | phases through walls + oneway |
| **Bunny** | same | **2-cell hops** | cannot shove pigs |
| **Frog** | same | **leap to blocker, up to 3** | re-leaps / turns if blocked |
| **Panda** | same | full slide | only moves when `parity === 1` (every other swipe) |
| **Cat** | same | full slide | turns CW once when blocked |
| **Chick** | **previous swipe's dir** | full slide | delayed replay (`state.lastDir`) |
| **Pig** | none (passive) | shoved 1 cell | solid blocker |

The pattern: almost everything is "go the same way as the swipe." The only direction
transforms in the whole game are balloon (opposite) and chick (previous). There are
**no relational movers** (toward/away), **no perpendicular mover**, **no edge-wrap**,
and the second parity slot (`parity === 0`) is unused.

Note: snail already fills "slow single-cell walker," so no turtle is needed.

## New friends (fill the empty cells)

Each is cute, front-facing, animatable: a round translucent blob with ONE signature
feature + a colour tint, an idle loop, and an action animation. The behaviour reads
from the animal itself.

| New friend | Movement type (NEW) | Rule | Reads because |
|---|---|---|---|
| **Crab** | perpendicular | 90 degrees to the swipe, full slide (fixed handedness) | crabs walk sideways |
| **Puppy** | homing (relational) | 1 cell toward the nearest heart / dot | puppies follow you |
| **Mouse** | fleeing (relational) | 1 cell away from the nearest dot | mice scurry away |
| **Owl** | anti-parity twin | full slide, but only when `parity === 0` | nocturnal - awake while panda sleeps |
| **Mole** | edge-wrap | slides, tunnels off one edge, re-emerges opposite (toroidal) | moles burrow and pop out elsewhere |

### Look + animation
- **Crab** - two tiny claws + stalk-eyes, coral tint. Idle: claws open/close. Move: sideways scuttle, eyestalks wiggle.
- **Puppy** - floppy ears + tiny tongue, cream/tan tint. Idle: tail wag. Move: ear-flop hop toward target.
- **Mouse** - big round ears + whisker dots, dusty-grey tint. Idle: ear twitch. Move: startled squash + scurry back.
- **Owl** - big front eyes + ear-tufts + beak, lilac tint (most on-brand: eyes are the house style). Idle: slow blink. Move: 180 degree head swivel.
- **Mole** - big pink nose + tiny dig-claws + squinty eyes, taupe tint. Idle: nose twitch. Move: dig-puff vanish, pop-up emerge.

## Deliberately NOT a friend

**One-cell mirror** and **axis-mirror** (move opposite / flip one component) have no
animal that naturally says "I do the reverse of you." Keep mirroring as a **field
tile** (a literal mirror/glass cell) where abstraction is fine. Friends stay legible.

## Ship order

1. **Crab, Puppy, Mouse** - introduce the entire relational dimension
   (sideways / toward / away) the game completely lacks. Each reads instantly.
2. **Owl** - nearly free (inverts panda's parity) and pairs with an existing face.
3. **Mole** - new but self-contained physics.

## Engine implications

### Schema (`src/engine/types.ts`)
Additive and serialisable, matching the existing pattern:
- extend `MoverKind` with `'crab' | 'puppy' | 'mouse' | 'owl' | 'mole'`
- add to `FRIEND_KEYS` and the `GameState` arrays (`crabs: Pt[]`, ...)
- add optional `LevelDef` authoring arrays (`crabs?: XY[]`, ...)

No state-shape change needed: owl reuses `parity`; homing/fleeing read dots/hearts
already in `GameState`.

### Step resolver (`src/engine/move.ts`)
- **Owl:** pre-seed/gate on `state.parity === 0` (panda gates on `=== 1`).
- **Crab:** rotate `dir` 90 degrees before running the mover.
- **Mole:** in the slide loop, on an out-of-bounds step wrap to the opposite edge
  instead of stopping; add a visited guard so an empty row cannot loop forever.
- **Puppy / Mouse:** resolve target dir from board state at the top of the move, then
  run 1 cell.

### Solver (`src/engine/solve.ts`) - the one real risk
The BFS treats a move as `(state, dir) -> state`. Crab, owl and mole stay pure
functions of `(state, dir)`, so they cost nothing extra. **Homing and fleeing depend
on other pieces' positions**, so the same swipe in two states can move the puppy
differently. That is already true for chicks (`lastDir`) and pandas (`parity`), both
of which the solver handles because those inputs live in `GameState`. Puppy/mouse stay
sound **as long as their target selection is deterministic** (nearest heart, ties
broken by fixed cell order). Lock that determinism down before implementing them.
