# Design doc: "Create Your Own Adventure" - level editor + accountless sharing

Date: 2026-06-14. Status: DESIGN ONLY, not yet implemented. No code written.
When built: do it in a NEW git worktree on ONE branch -> PR.

This is the deep design for a mobile-first level editor and an accountless
level-sharing ecosystem for Squishy & Friends. Durable repo facts (stack, the
already-built iOS app, the `solve()` solver, hash routing, persistence keys) live
in the root `CLAUDE.md`; this file is the one-time design, not standing rules.

Researched online 2026-06-14 (mobile editor UX, accountless UGC ecosystems, offline
QR + checksum + capability detection). Sources at the bottom.

---

## 1. Golden goal

Let any player build their own Squishy level on their phone in under a minute, prove
it is solvable, and share it as a link + QR code that opens straight into the game -
with NO account, NO server, NO backend, NO login, and NO free-text input anywhere.
"Create your own adventure."

Hard constraints (from Franz):
- Super mobile-first. Everything on ONE iPhone screen. One-handed.
- A shared level can NEVER be unsolvable - solvability gates publish/share.
- The share URL is shown as a scannable QR barcode, and is self-checked before it is
  ever handed to the user.
- Every browser capability/library is feature-detected; a missing one disables exactly
  one path with a clear message, never breaks silently.
- No accounts. No captions. No typed text from users, anywhere.
- Saved levels are listed in a builder overview and are individually deletable.

---

## 2. The one-screen editor (mobile-first)

Thumb-zone law: the easy-reach arc is bottom-center to bottom-right; it does NOT grow
on taller phones. So push controls DOWN, keep the board UP. (Hurff, Smashing Mag.)

Layout, top to bottom:
1. **Board (top ~60-70%)** - centered, fit-to-view, never scrolled away from. This is
   the thing you look at, not the thing you constantly tap (Procreate canvas-centric model).
2. **Status strip (directly under the board)** - live validation: specific speech-bubble
   hints + a persistent "Solvable ✓ / No solution ✗" chip (see §3).
3. **Tile palette + actions (bottom, thumb green zone)** - tappable tile swatches with a
   clear active-tool highlight, plus the action buttons (Try it / Save / Share).

Tool groups bound to screen regions by function (Super Mario Maker 2 model); never one
giant undifferentiated bar. Offer a handedness flip and a "hide UI to see full board" toggle.

### Placement interaction
- Tap a palette swatch to set the active tile -> tap the board to place -> drag to paint
  a stroke of that tile (PuzzleScript / Mario Maker single-gesture model).
- **Eraser = the empty tile as a brush** (Baba Is You). Selecting "empty" and painting removes.
- **Drag a piece OFF the board to remove it** (Franz's requirement). Pick up an existing
  piece and drag it past the board edge -> it is deleted. This is the natural "throw it
  away" gesture, complementing the empty-tile eraser. Dragging a piece to another cell moves it.
- Heart (target) and squishy (mover) are **unique relocating tiles**: placing a new one
  moves the existing one rather than erroring. Uniqueness over forced ordering - do NOT
  force "place heart first, then squishy"; just enforce "exactly one heart, >=1 squishy".
- Walls and special tiles are paintable classes (many allowed).
- Reserve TWO-finger gestures exclusively for pan/zoom; double-tap = fit-to-view. Keeping
  draw (one finger) and navigate (two fingers) on different finger counts means panning can
  never mis-place a tile.

### Board size control
- Research verdict: for a small fixed set (4x4..7x7) use **preset chips / a segmented
  control** (one tap, all options visible, applies instantly), NOT a dropdown (Apple HIG:
  segmented controls for <=5 options; NN/g: steppers/chips beat dropdowns for small ranges).
- Franz asked for a "quick size dropdown" - honor the INTENT (fast size switching) with the
  better mobile widget: a row of size chips. If we ever exceed ~6 sizes, switch to a dropdown.
- Resizing MUST preserve already-placed pieces (crop/extend, never rescale).

### Onboarding (zero-text, casual/kids friendly)
- Open ON a tiny, pre-filled, already-solvable starter board - never a blank grid (Trello
  empty-state lesson). First act is editing, not creating-from-nothing.
- ~2s ghost-finger demo placing + solving one piece (Nintendo "show, don't tell").
- Reveal one tool at a time; the palette grows as tools are used (Levelhead / Yamamura's Dojo).
- Large zero-text icons (Toca Boca). If a button needs a word, the icon is wrong.
- Any hint is contextual, single-element, spotlit, skippable, shown once (NN/g).

---

## 3. Live validation + the solvability gate (cannot publish broken)

Two tiers, non-blocking, specific messages, with positive confirmation:
- **Tier 1 - instant structural invariants** (cheap, synchronous): exactly one heart
  present, at least one squishy present, board not empty. Shown as speech-bubble hints
  under the board: "Place a heart", "Add a squishy". The bubble VANISHES the instant the
  problem is fixed (Baymard inline-validation rules). Validate on-pause, never per-keystroke.
- **Tier 2 - full solvability** (expensive): run the existing `solve()` (`src/engine/solve.ts`,
  BFS) in the BACKGROUND (ideally in the existing worker, off the main thread), never
  blocking edits. Resolve to a persistent status chip: "Solvable ✓" (green) or "No solution ✗".
- Always show the positive state, not only errors - a green "Solvable ✓" gives progression.
- Messages are specific and counted: "1 heart needed (found 0)", "Goal unreachable", beats
  a generic "invalid". Users fix specific errors ~3x faster.

### Publish gate ("prove it to ship")
The single most-copied UGC convention. Publish/share stays LOCKED until the level is
proven solvable. Two compatible ways to satisfy the gate, use both:
- The background `solve()` proves solvability automatically, AND
- The maker can "Try it" and clear it themselves (Super Mario Maker 2 "Clear Check",
  Levelhead "Play and Verify", Trackmania green-flag validation).
- Bonus (Trackmania "Author Time"): the optimal move count from `solve()` becomes the
  **par / star target** baked into the shared level - no extra input needed.
- Re-lock the gate if the board changes after it was verified.

A level that is "off a little bit / not solvable" simply cannot be published - the Share
button is disabled with the reason shown, exactly as Franz described.

---

## 4. The build -> test-play -> edit loop

- One prominent "Try it" button toggles into the live game ON THE SAME SCREEN (PuzzleScript
  press-E tightness; Mario Maker clapboard).
- Failing or finishing returns you to the editor with EVERY piece exactly where you left it
  (no reload, no save prompt, state intact). The playtest IS the iteration loop AND the gate.

---

## 5. Saved levels: "Your Creations" library (Franz's requirement)

- A **builder overview** lists already-saved levels as cards (thumbnail of the board, par,
  solvable badge). Reachable from the home screen and from the editor.
- Each saved level can be: opened/edited, played, shared (QR + link), and **DELETED**
  individually (with a confirm). Deletion is real and immediate.
- Custom levels also appear pinned at the TOP of the main level picker (a "Yours" section),
  slotting into the SSOT `loadLevel()` via a `play.kind === 'custom'` branch.
- Storage: new `squish-custom:*` localStorage keys (one per level) + a `squish-custom-list`
  index key. All under the `squish-*` prefix, so the existing `resetProgress()` wipe covers
  them (`src/game/persist.ts`). Local-only (Wordle-style); offer an export/import code later
  for device portability without an account.

---

## 6. Share system

### URL scheme - human-readable glyph grid + integrity
Keep Franz's readable scheme (NOT base64/DEFLATE - the board is tiny so readability wins):

`squishy.franzai.com/#level-<v>-<w>x<h>-<glyphs>.<crc>`

- One glyph per cell, row-major. `0`=empty, `x`=wall, `f`=frog, `h`=heart, `s`=squishy, etc.
- PROVEN LOSSLESS: all 50 curated levels have ZERO overlapping cells (verified 2026-06-14),
  max board 7x7 -> <=49 glyphs + tiny header. Editor invariant "one element per cell" keeps
  it lossless forever.
- `<v>` = version prefix so future glyph-table changes never break old links.
- `<w>x<h>` dimensions (width reshapes the flat string; height = len/width).
- `.<crc>` = a short CRC32 of the body as base36 (~6-7 chars) to detect corruption (truncated
  paste, a dropped char). CRC32 beats Adler-32/Fletcher on short strings.
- `par` is NOT encoded - recomputed by `solve()` on import (which also re-validates).
- GLYPH TABLE is a new SSOT file (char <-> cell type). First letters collide
  (bears/bunnies/balloons/boxes all "b"; cats/chicks "c"; pandas/pigs/penguins/portal "p";
  snails/spring/split/sticky/stars "s") so assign distinct chars deliberately. ~26 types fit
  in a single-char alphabet. Directional `oneway`/`breeze` get 4 glyphs each (or a dir suffix).

### Self-check (Franz's requirement: catch a broken share URL)
- At ENCODE time: build the URL, then DECODE it and deep-equal the result against the
  original level. If they differ, THROW and refuse to show the link/QR (fail loud, no broken
  link ever handed out - matches the global "fail fast, no fallbacks" rule).
- At IMPORT time: verify the CRC before decoding; on mismatch, show a clear "this level link
  looks corrupted" error and refuse to load. Then `solve()`-validate the decoded level
  (untrusted DATA, never code - safe, but must be validated before play).

### QR code is the PRIMARY share primitive (critical iOS finding)
- The iOS `app://` scheme is NOT a secure context in WKWebView, so `navigator.clipboard` is
  unavailable and `navigator.share` is unreliable INSIDE the app. The QR code needs no OS API
  and no secure context - just Canvas, which works everywhere (Safari AND `app://`). So the QR
  is the universal share path; Web Share / Copy are progressive enhancements on top.
- Library: **`qrcode-generator`** (kazuhikoarase) - ~4-5kB, zero deps, MIT, draws to Canvas.
  Chosen over node-qrcode (heavier) for the "every byte counts" offline bundle.
- For a ~60-120 char URL use auto-version + EC level M (lands ~V4-7, comfortably scannable).
  Keep the URL under ~150-180 chars; render >=4-6px per module; always include the 4-module
  quiet-zone border (skipping it is the #1 cause of unscannable codes).
- ALWAYS share the public https URL, never an `app://` URL (Web Share rejects custom schemes).

### Capability detection (Franz's "check every library is available")
- Feature-detect, never UA-sniff. One detector per capability, each gating exactly ONE button:
  - `canvas`: `getContext('2d')` works -> QR always available.
  - `share`: `typeof navigator.share === 'function'`.
  - `shareFiles`: probe `navigator.canShare({files:[new File(...)]})` (the only reliable test).
  - `clipboardWrite`: `navigator.clipboard?.writeText` AND `window.isSecureContext === true`.
- A missing capability disables its one button with a clear message ("Sharing not available -
  scan the QR code"), never a silent break. `navigator.share`/`writeText` MUST be called
  synchronously inside the click handler (WebKit invalidates user activation if you await first).

### Virality (accountless, proven by Wordle/Mekorama/Draw Something)
- Two share artifacts:
  1. "Can you beat my level?" -> the level URL + QR (Mekorama "level card" model; self-contained,
     no link rot because the level is IN the link, not referenced on a server).
  2. A spoiler-free RESULT card after solving someone's level ("Solved in N moves" + abstract
     pattern, no answer shown) - the Wordle curiosity-gap engine. Plain text pastes natively
     into iMessage/WhatsApp/Discord; no link preview needed.
- Reuse the existing GIF/PNG postcard pipeline (`src/game/share.ts`, `shareGif.ts`).
- Daily puzzle already exists - keep it as the synchronized, comparable, share-driven habit.

---

## 7. Identity & attribution without accounts (DECISION NEEDED)

Franz wants community/credit but NO typed text. Resolution that satisfies both: a
DETERMINISTIC generated identity, never typed.
- Per-device random seed stored locally, baked into every shared level payload.
- On open, render "made by [AdjectiveAdjectiveAnimal] + creature glyph" - e.g.
  "made by SleepyBraveOtter 🦦" - name from a CURATED safe word list (Gfycat scheme), avatar
  a visual hash (identicon / Boring-Avatars style). Stable, unique, memorable, attributable.
- Because nothing is typed and words come from a curated list, there is NOTHING to moderate -
  the moderation surface is removed, not policed. This fits the cosy-creature aesthetic.
- OPEN DECISION for Franz: include this generated "made by" credit (recommended - it is
  generated, not user text, so it respects "no typed text"), or ship fully anonymous with no
  maker credit at all? It adds a few bytes to the URL.

---

## 8. Discovery & ecosystem (no server)

Serverless UGC externalizes discovery, then re-internalizes a curated subset:
- Bake a fixed curated campaign + a rotating set of hand-picked "featured community levels"
  INTO each app update (Baba Is You "Version + New Featured Levels" model). Curation
  out-of-band, distribution via the app build, no live query.
- "Level of the day" = a deterministic pick from the bundled curated set (date-seeded, no server).
- Seed one official subreddit + one Discord as the community substrate (forums outlast Discord
  for link persistence).
- Accept the trade-off: no in-app popularity analytics unless you reuse the existing anonymous
  counter; no in-app feed of others' levels (this is also the safest App-Store posture, §9).

---

## 9. Apple App Store compliance (Guideline 1.2 - UGC)

- 1.2 mandates, for UGC/social apps: content filtering, a report mechanism, the ability to
  block, and published contact info. There is NO authoritative Apple ruling on whether pure
  geometry shared by URL triggers it.
- Strongest "not really UGC" posture: **share-sheet / QR only, with NO in-app gallery to browse
  OTHER people's levels.** Content is never "posted to the app." This is the single biggest lever.
- Cheap belt-and-suspenders (do it anyway, ~half a day): a Report/Flag button on any OPENED
  shared level, a hide/block-this-content control, published support contact in-app, and an
  EULA objectionable-content clause. Residual risk is only "blocks arranged to draw something
  offensive" (low) - the Report button covers it.
- Privacy label stays clean (no PII). Don't route share URLs through a third-party shortener.

---

## 10. iOS specifics

- **Deep-linking (share link opens the installed app)** - Universal Links, FEASIBLE (the app
  already exists, so this is glue):
  1. Host AASA at `https://squishy.franzai.com/.well-known/apple-app-site-association` (JSON,
     no redirect) - one new route in the existing Worker.
  2. Add `applinks:squishy.franzai.com` associated-domains entitlement - small `ios-app-maker`
     generator addition (config -> entitlement + Info.plist), then re-sign / re-submit.
  3. Swift glue: handle the incoming `NSUserActivity`, map the external URL's hash (`#daily`,
     `#level-...`) onto the already-loaded offline `app://index.html` (set `location.hash` +
     re-run boot).
  - Universal Links bind only after install + first AASA fetch; long-press "Open in Squishy"
    is the expected fallback.
- **`app://` is not a secure context** -> QR is the offline share primitive (see §6).
- **Bundle bytes**: the QR lib is tiny (~4-5kB); the editor is a new mode reusing the single
  renderer. Keep the bundle lean so the offline iOS app stays small ("save bytes").

---

## 11. Home-screen integration ("Create your own adventure")

- Add a clear "Create your own adventure" entry on the home/start screen leading to the editor
  and the "Your Creations" overview.
- Make room for it without breaking the existing iOS layout (the home screen must still work on
  iPhone with the new button). Audit `startMenu` / home layout; keep it one-screen, thumb-reachable.

---

## 12. Recommended phasing

- **Phase A - web-only editor (ships immediately, no iOS/server dependency):**
  one-screen editor, tap/drag placement + drag-off-to-remove, size chips, two-tier validation
  with speech bubbles, `solve()` gate, Try-it loop, "Your Creations" overview with delete,
  `#level-...` readable-grid share with CRC + self-check, QR via `qrcode-generator`, capability
  detection. Home-screen "Create" entry.
- **Phase B - iOS deep-link:** AASA Worker route + `ios-app-maker` associated-domains + Swift
  `NSUserActivity` handler, so `#daily` and `#level-...` open the installed app.
- **Phase C - ecosystem polish:** generated maker identity (if approved), result cards,
  featured-levels-in-update pipeline, optional export/import code, Report/hide + EULA compliance.

---

## 13. Open decisions for Franz

1. Generated "made by SleepyBraveOtter" maker credit (§7): include (recommended, it is generated
   not typed) or fully anonymous?
2. Size set for the chips: confirm 5x5 / 6x6 / 7x7 (or include 4x4 and a "big" 8x8+?).
3. Compliance package now (Phase A) or at iOS submission (Phase C)? Recommended: at submission,
   but the share-sheet-only / no-in-app-feed posture is baked in from the start.

---

## 14. Sources (researched 2026-06-14)

Editor UX: scotthurff.com thumb-zone; smashingmagazine.com thumb-zone; Procreate handbook;
gameuidatabase (SMM2); PuzzleScript level-editor docs; Baba Is She wiki editor; Apple HIG
segmented controls; nngroup input-steppers & onboarding; baymard inline-validation; SMM2 Clear
Check (attackofthefanboy, shacknews, Wikipedia Team 0%); Levelhead Play-and-Verify;
Trackmania map-editor validation.

Accountless UGC: Wikipedia URI-fragment, Wordle, Draw Something, K-factor; PuzzleScript
permanent-urls; Mekorama FAQ + sbliven/mekoqr; Sokoban .sok/XSB format; ChessMsgs (Google Cloud
blog); base64url (base64.guru); Apple review guideline 1.2 (developer.apple.com); identicons
(Wikipedia), Boring Avatars, Gfycat naming; Wordle localStorage (siskinds, tomsguide);
Duolingo streaks (uxmag); Baba featured-levels update.

Offline QR + integrity + capabilities: qrcode-generator (npm), node-qrcode, qr-creator; QR
capacity (qrmake.dev, qrcode.com, qrcodechimp); CRC/Adler/Fletcher (Wikipedia, CMU); WKWebView
custom-scheme-not-secure (dev.to/alastaircoote, cordova-ios#1163); Async Clipboard (webkit.org);
canShare (MDN); Web Share API spec (w3.org); writeText user-activation (Apple forums).
