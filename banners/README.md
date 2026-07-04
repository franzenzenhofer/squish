# Display-ad banners

Mobile-first IAB display-ad creatives for **Squishy & Friends**. The cute
characters are the HERO: the banners hand-compose BIG friend sprites with the
game's own `SPR` painters (`src/game/banners.ts`), driven headlessly through
`window.__squishBanners` (`scripts/banner-shots.ts`). No mockup art. One unified
claim on every creative: the **Squishy & Friends** wordmark + **Free • No Ads** +
a **Download now** App Store CTA.

## Retina 2x — crisp on iPhone

Every file is exported at **2x its nominal IAB size** (a 300x250 slot ships as a
600x500 asset), so it stays sharp on high-DPI iPhone screens instead of being
upscaled into a blur. Aspect ratios are identical — only the pixel density goes
up. Everything is **WebP** (a 2x PNG blew the weight cap; WebP is crisp, tiny,
and supported by iPhone Safari + Google/Meta ad placements).

## Why not just render a board?

Every curated level fills only ~14% of its grid, so a rendered board reads as an
empty sea of dots with tiny characters. So the hero banners draw the friends
directly (`SPR[name](ctx, {x, y, r, now, seed, idle, mood})`), big and cute,
independent of any grid. The real board still appears — but only in the `board`
and `gameplay` variants, on its own white card.

## Regenerate

```bash
npm run banners
```

Requires the `img2webp` CLI (muxes the animated WebPs) — `brew install webp`.
Builds, serves on :4378, wipes `banners/out/` and regenerates every combo
(gitignored — always a clean, exact regen). The generator **throws and exits
non-zero** if any file exceeds the 150KB ad-network weight cap — no silent
recompression.

## Sizes (mobile-first, IAB standard; exported at 2x)

| Slot | Name | Asset px (2x) |
|------|------|---------------|
| 320x50 | Mobile Banner | 640x100 |
| 320x100 | Large Mobile Banner | 640x200 |
| 300x250 | Medium Rectangle (MREC) | 600x500 |
| 250x250 | Square | 500x500 |

Leaderboard (728x90), interstitial (320x480) and skyscraper (160x600) are
deliberately out of scope — this set targets mobile placements only.

## Variants (`<size>-<variant>.webp`)

| Variant | Animated | What it shows |
|---------|----------|---------------|
| `parade` | strips: yes / squares: no | A cluster of big cute friends (squishy + cat + frog + penguin + bunny) |
| `giant` | no | One oversized Squishy centre-stage, two friends peeking |
| `board` | no | The real board (dense 6x6), cropped tight on its white card |
| `gameplay` | yes | Real board play — a move every 430ms, then a hold |
| `bounce` | yes | The parade friends hop + blink (seamless phase loop) |

- **Strips** (`320x50`, `320x100`): `parade`, **animated** (hop + blink). The
  320x50 is too small for the badge — wordmark + characters carry it there.
- **Squares** (`250x250`, `300x250`): all three static variants (`parade`,
  `giant`, `board`) plus both animated (`gameplay`, `bounce`), so the strongest
  can be picked per placement.

## Output

12 WebP files: `parade` x4 sizes (strips animated, squares static),
`giant`/`board` x2 squares (static), `gameplay`/`bounce` x2 squares (animated).

## Encoding

Everything is **lossy WebP** (no GIF — its 256-colour palette bands the pastel
gradient; no lossless — a many-frame 2x file blows the cap):
- **Static** frames: `canvas.toBlob('image/webp', 0.92)` — near-lossless.
- **Animated** frames: muxed by `img2webp -lossy -q 80`; motion hides the lower
  quality and it keeps the retina-2x many-frame files under the 150KB cap.
- `gameplay` plays a move every 430ms then holds ~1.1s; `bounce` (and the
  animated strips) run a full phase loop of hop + squash + sway with a staggered
  per-friend blink — seamless by construction.

## Iterating

Use the `banner-designer` subagent (`.claude/agents/banner-designer.md`) for any
follow-up work — new copy, a new size, a new variant — so brand rules and the
pipeline don't need re-explaining each time.
