# App Store screenshots

Submission-ready iPhone screenshots for **Squishy & Friends**, generated from the
**live build** (no mockups): the real game is driven through `window.__squishy`
to each best-moment state, captured at true 6.9" retina, then composed with a
branded caption.

## Regenerate

```bash
npm run shots
```

Builds, serves on :4378, captures + composes, writes to `appstore/out/`.
(Generator: `scripts/appstore-shots.ts`. `appstore/out` and `appstore/raw` are
gitignored - regenerate any time.)

- `out/` - final marketed screenshots (caption + framed game) - **upload these**
- `raw/` - clean full-bleed game frames, no caption (handy if you want to
  re-compose or use elsewhere)

## Spec (verified)

- **Size: 1320 x 2868 px** - the iPhone 6.9" lead size required by App Store
  Connect in 2026 (iPhone 16/17 Pro Max). Pixel-exact; Apple rejects if even 1px
  off. (1290x2796 is the 6.7" fallback - not generated; flip `DEV`/`CANVAS` in
  the script to 430x932@3x to make it.)
- PNG, RGB, **no alpha channel** (App Store-safe), 72 dpi.
- Apple needs only this one iPhone size; it downscales for smaller devices.

## The set (story order - first 3 carry the pitch)

Best practice: ~90% of users never scroll past screenshot 3, so the first three
lead with emotion + real gameplay; captions are short and benefit-driven; big
type; bright on-brand pink; a narrative across the set.

| # | File | Caption | State |
|---|------|---------|-------|
| 1 | `01-hero` | Squish them onto the heart | Home: wordmark + friends |
| 2 | `02-slide` | Slide to merge your squishies | Level 4 (penguin, ice) |
| 3 | `03-twists` | Cozy puzzles, clever twists | Level 46 (portals, friends, stars) |
| 4 | `04-friends` | A whole world of friends | Level 50 (full cast) |
| 5 | `05-daily` | A fresh puzzle every day | Today's daily |
| 6 | `06-levels` | 50 levels and an endless ladder | Level picker, unlocked |

## Upload

App Store Connect -> your app -> the version -> **App Previews and Screenshots**
-> **iPhone 6.9" Display** -> drag in `out/01..06` in order. Order = display order.
