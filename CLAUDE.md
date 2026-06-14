# CLAUDE.md - Squish ("Squishy & Friends")

Guidance for Claude Code working in this repo. Global config (credentials, keys,
browser automation) lives in `~/.claude/CLAUDE.md`. This file is project-specific.

Last updated: 2026-06-14

## What this is

A cosy slide-puzzle game. Swipe to send squishy characters gliding across a board
(springs, ice, portals, friends, hazards) until every friend lands on its heart.
No ads, no accounts, fully offline-capable. A fresh daily puzzle each day.

- **Live web:** https://squishy.franzai.com
- **iOS:** "Squishy & Friends", bundle `com.franzai.squish`, team `7D2YX5DQ6M`

## Stack

- **Vanilla TypeScript** (strict). No React/Vue. Canvas rendering, single renderer.
- **Vite 6** build. Two entries: `index.html` (game), `debug.html` (debug mode, `?debug=doit`).
- **Cloudflare Worker** (`src/worker.ts`) serves static assets + `POST /t` anonymous
  counters to Analytics Engine (`squish_events` dataset). Privacy-by-design.
- One dependency: `gifenc` (share GIFs). Dev: Playwright, Vitest, ESLint, Wrangler, tsx.

## Build / gates / deploy

```bash
npm run dev          # vite dev server
npm run build        # web build (VITE_PLATFORM=web)
npm run build:ios    # iOS build (VITE_PLATFORM=ios)
npm run gates        # typecheck && lint && test && build  (ALL must pass)
npm run deploy       # gates + wrangler deploy to squishy.franzai.com
npm run daily:verify # verify daily puzzles solvable (SLOW - see memory note)
npm run levels       # rebuild src/levels.json from authoring scripts
npm run e2e          # Playwright e2e (excluded from `test`)
```

## Two build targets (one core, SSOT)

ONE game core ships as web (default) and iOS, selected by Vite `VITE_PLATFORM`
(`web` | `ios`). See `src/game/main.ts` (`PLATFORM`, `TRACK_URL`).
- Web: hosted at `squishy.franzai.com`, analytics posts to relative `/t`.
- iOS: 100% offline, analytics posts to absolute `https://squishy.franzai.com/t`
  only when `navigator.onLine`, with a Settings opt-out toggle (web is always-on).
- Both write the SAME anonymous counters, split by a `p:'web'|'ios'` flag in
  `src/lib/trackSchema.ts` (`blobs[2]`).
- `window.__ready = true` is the boot signal the iOS WKWebView waits on.

## iOS app - ALREADY BUILT (do not "build from scratch")

The iOS app exists and has been packaged. It is produced by the `ios-app-maker`
factory, NOT in this repo:

- Factory: `/Users/franzenzenhofer/dev/ios-app-maker`
- Squish app dir: `apps/squish/` (config `apps/squish/app.config.json`, iOS sources
  in `apps/squish/ios/`, build output in `apps/squish/ios/build/`).
- It is a **SwiftUI + WKWebView** wrapper that serves the bundled web build **offline
  via a custom `app://` URL scheme** (`apps/squish/ios/Sources/AppSchemeHandler.swift`,
  scheme = `"app"`). The webview loads `app://.../index.html`. It does NOT load the
  public https site.
- `app.config.json` wraps this repo via `web.upstream` (repoPath `../../../squish-two-target`,
  buildCommand `npm run build:ios`, strategy `symlink`), `readyExpression`
  `window.__ready === true`.
- Deployment target iOS 18.0, Swift 6.0, device family iPhone+iPad. App Store
  metadata (name/subtitle/description/keywords/review notes) all live in the config.

Implication: future iOS changes are factory + glue changes, not a new app.

## Architecture map (where things live)

### Level data model
- Schema `LevelDef` in `src/engine/types.ts` - plain JSON, ~600 bytes/level. Fields:
  `w,h,target,dots,par,cap?,sol?` plus optional field cells (`walls,noms,sticky,
  split,turn,ice,jelly,spring,oneway,breeze,portals`), friend movers
  (`penguins,bears,ghosts,bunnies,frogs,pandas,cats,chicks,pigs`), collectibles
  (`stars,boxes,balloons,snails`). Fully serializable as-is.
- Curated campaign levels 0-49: `src/levels.json`.
- Daily: deterministic `generateDaily(date)` in `src/gen/daily.ts` (date-seeded).
- Endless 50+: generated on demand, `src/gen/generate.ts` + `ramp.ts`.

### Solver (important!)
- `solve()` in `src/engine/solve.ts` (BFS). Also `spamSolvable()`, `featureUse()`.
- Used to validate generated/daily levels and compute optimal par. Reuse this to
  validate ANY hand-made or imported level for free.

### Level loading (SSOT)
- The single loader is `loadLevel(li)` in `src/game/main.ts` (~line 270). Used at
  boot, on "Continue", and on next-level-after-win. `assist.getLevel(li)` is the
  one level source.
- Picker UI: `src/game/levelsPick.ts`. Boot decision: `src/game/flow.ts` (`bootPlan`).

### Hash-URL routing (deep links)
- `bootPlan(savedLi, hash)` in `src/game/flow.ts`. Today: `hash === '#daily'`
  launches the daily, otherwise resume campaign. `src/game/main.ts` ~line 683.
- This is the proven mechanism for any future `#...` deep link.

### Sharing
- `src/game/share.ts` (`shareCard`) + `src/game/shareGif.ts`. Web Share API with a
  fallback chain: animated GIF -> static PNG postcard -> text link -> clipboard.
- Share URLs: `https://squishy.franzai.com` or `.../#daily`.

### Persistence (localStorage, all prefixed)
- `squish-progress-v2` resume state, `squish-gen-v6:*` cached endless levels,
  `squish-daily-v2:*` daily cache, `squish-settings-v1`, `squishy-met-v2` overlay flags.
- `resetProgress()` in `src/game/persist.ts` wipes ALL `squish-*` / `squishy-*` keys (SSOT).

## Design rules (load-bearing - violating these has burned us before)

- Pinned/curated levels are SSOT - never let daily/generated levels leak into the
  campaign loader path. (See commit "one campaign loader behind boot AND Continue".)
- One renderer for all contexts. Always animate. Overlay/bubble gating.
- The "oh-no" reversibility tripwire and per-level contracts must hold.
- Prove "unchanged" with golden baselines covering every case (regression testing).
- Daily verifier is SLOW - do not re-run it once it has passed in a session.

(See the project memory files under
`~/.claude/projects/-Users-franzenzenhofer-dev-squish/memory/` for the full versions.)

## Design docs (not auto-loaded - read on demand)

- `docs/level-editor-design.md` - full mobile-first design for the "Create your own
  adventure" level editor + accountless sharing: one-screen editor (tap/drag place,
  drag-off to remove), size chips, two-tier validation with speech bubbles, the
  `solve()` publish gate, Try-it loop, "Your Creations" overview with delete, the
  human-readable `#level-<v>-<w>x<h>-<glyphs>.<crc>` share URL (one glyph/cell, proven
  lossless) with round-trip self-check, QR-code sharing (primary on iOS since `app://`
  is not a secure context), capability detection, accountless ecosystem + Apple UGC
  compliance, and iOS Universal-Link deep-linking. Researched online 2026-06-14.
