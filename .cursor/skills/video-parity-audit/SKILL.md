---
name: video-parity-audit
description: >-
  Audit a static HTML prototype against a source screen-recording video for
  exact content parity (dropdown options, chart data, table rows, icons,
  layout details), using ffmpeg scene-detection and contact-sheet thumbnails
  instead of manually guessing timestamps and reading full-resolution frames
  one at a time. Use when a video of a real product is provided and the
  prototype must match it exactly, when auditing dropdowns/charts/tables
  against a recording, or when the user says a prototype "doesn't match" a
  video/screenshots.
---

# Video Parity Audit

## Why this exists

Manually guessing timestamps and reading one full-resolution video frame at a
time is expensive (each image read costs real tokens) and unreliable (it is
easy to guess a timestamp that misses a real UI change entirely — this
happened on this project: a Term dropdown with real data was declared "never
opened in the video" simply because the wrong timestamps were sampled).

This skill replaces that with: scene-detection to find every real UI change
automatically, contact sheets to triage dozens of moments per image read, and
targeted full-resolution reads only for the handful of moments that need
precise text/data extraction.

## Workflow

```
Task Progress:
- [ ] Step 1: Extract change-points from the source video
- [ ] Step 2: Build contact sheets (thumbnail + auto diff-crop per tile) from the change-points
- [ ] Step 3: Triage contact sheets, note interesting timestamps
- [ ] Step 4: Pull targeted full-resolution frames for interesting timestamps
- [ ] Step 5: Cross-reference against the prototype HTML and fix real gaps
- [ ] Step 6: Re-render the prototype recording
- [ ] Step 7: Run the SSIM regression gate against the prototype recording and fix anything flagged
```

### Step 1: Extract change-points

```bash
node scripts/extract-changepoints.js videos/original.mp4
```

Writes `.tmp/changepoints/original.json`, a list of `{t}` timestamps where
the screen visibly changed. Default sensitivity (`0.003`) is tuned for
desktop UI walkthroughs where dropdowns/panels only cover part of the screen.

**Do not use ffmpeg's typical scene-cut default (~0.02)** — it is tuned for
full-frame video-editing cuts and silently misses partial-screen UI changes
like a dropdown opening. This was verified empirically: `0.02` produced zero
change-points across a window known to contain multiple dropdown
open/close events; `0.003` correctly caught them.

If a specific video is very noisy (e.g. a webcam bubble with a talking head
covering part of the frame), raise the threshold incrementally and re-check
that known interaction windows are still captured before trusting the result.

### Step 2: Build contact sheets

```bash
node scripts/build-contact-sheets.js videos/original.mp4 .tmp/changepoints/original.json
```

Writes grid images to `.tmp/contact-sheets/sheet-NN.jpg` (default 30 tiles
per sheet, 6 columns) plus `manifest.json` mapping every grid tile, in
row-major order, to its exact source timestamp.

**Each tile is a vertical pair, not a single thumbnail**: the top half is
the normal full-frame thumbnail (context), the bottom half is an
auto-cropped, upscaled "what changed" region computed by
`scripts/diff-region.js` (ffmpeg `blend=difference` + `bbox`, against the
previous change-point — pure ffmpeg, zero AI-token cost). This exists
because a small change in a corner of the screen (e.g. a dropdown menu
appearing near a page title) is easy to miss in a 320px-wide full-frame
thumbnail when something bigger is happening elsewhere in the same frame —
this was verified empirically on this project (see "Known misses" below).
A blank gray tile in the bottom half means ffmpeg detected no region above
the diff threshold — not necessarily "nothing happened," just nothing large
enough to bound a crop around; if that seems surprising for a given
timestamp, pull it at full resolution (Step 4) to be sure.

### Step 3: Triage

Read each `sheet-NN.jpg` with the Read tool. One image read covers ~30
moments (as pairs). Check BOTH halves of every tile — the full frame for
context and the diff-crop for exactly what changed — don't rely on the full
frame alone. Look for state changes: a dropdown opening, a chart appearing,
a table populating, a tab switching. Note the approximate tile position and
look up its exact timestamp in `manifest.json`.

### Step 4: Targeted full-resolution reads

For each timestamp worth reading precisely:

```bash
ffmpeg -ss <t> -i videos/original.mp4 -vframes 1 -vf scale=1000:-1 out.jpg
```

Read `out.jpg`. If text is still too small (e.g. a dropdown's option list),
crop tighter before scaling:

```bash
ffmpeg -ss <t> -i videos/original.mp4 -vframes 1 -vf "crop=W:H:X:Y,scale=1000:-1" out.jpg
```

Crop coordinates are in the source video's native resolution
(check with `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 <video>`),
not the scaled-down coordinates of any earlier screenshot.

### Step 5: Cross-reference and fix

For every real discrepancy found (missing dropdown options, wrong icon,
missing chart, placeholder table, etc.), fix it in the prototype HTML using
only documented markup for the design system in use. If a visible detail has
no documented equivalent, flag the gap explicitly instead of inventing markup
— do not guess at undocumented attributes/tags.

Preserve the source video's data exactly, including apparent glitches (e.g.
real duplicate entries in a dropdown) — do not "clean up" what's on tape.

**Real brand assets rule**: if a visible element looks like an
organization/product logo or brand mark — as opposed to a generic UI icon
(arrows, carets, status glyphs) — never approximate it with the closest
stock icon from the design system. Stop and flag it per the discrepancy
protocol, and ask the user for the actual asset file before implementing
anything. Concrete example from this project: an institution logo above a
profile picture was implemented as `hi-icon kind="account_balance"` (a
generic bank/institution glyph) instead of being flagged as "this looks
like a real logo, please provide the asset" — the user had to point out the
mistake themselves. The fix was `hi-image src=".../real-logo.png"`, matching
the pattern already used elsewhere in the same file for actual brand marks.

### Step 6: Re-render

Re-run the prototype's recording script to produce a new prototype video.

### Step 7: SSIM regression gate (mandatory before declaring "done")

```bash
node scripts/compare-videos.js videos/original.mp4 videos/prototype.mp4 .tmp/changepoints/original.json .tmp/compare-videos/report.json
```

For every change-point timestamp, extracts the matching frame from both
videos and scores similarity via ffmpeg's `ssim` filter (pure ffmpeg, zero
AI-token cost). Writes a report sorted worst-first and prints the
lowest-scoring timestamps.

This is a **relative triage heuristic, not an absolute pass/fail gate** —
a prototype using a different design system than the source app will
typically score ~0.65-0.75 even on a correctly-matching frame, not ~1.0.
Don't chase the absolute score to zero; instead:

- Look for outliers scoring far below the typical range for that stretch of
  video (e.g. well under the batch's median) — those are more likely to be
  genuinely missing/wrong content, not just different button/table styling.
- Ignore t≈0 low scores by default — video start often has a fade-in or an
  unstyled-content flash that's unrelated to real parity.
- For every flagged timestamp that isn't an obvious edge case, pull a
  full-resolution side-by-side (Step 4's ffmpeg command, run against both
  videos) and read it — this is the one step in the whole pipeline that
  costs real tokens, and it's now targeted only at the handful of moments
  the automated pass couldn't clear.
- Never declare a video-parity pass "done" without running this step at
  least once after the final re-render. Fix what it flags (or explicitly
  note it as an acknowledged/acceptable design difference) and re-run until
  clear.

## Efficiency notes

- 25fps video over ~500s is ~12,500 raw frames. Change-point detection
  typically reduces this to a few hundred meaningful moments — roughly a
  15-40x reduction before any images are even read.
- Reading one 30-tile contact sheet costs roughly what reading one normal
  single-frame screenshot costs, not 30x that. Most of the review should
  happen at the contact-sheet level; only drop to full-resolution single
  frames for moments that actually need precise text/data reading.
- `diff-region.js` and `compare-videos.js` are both pure-ffmpeg, zero
  -AI-token tools — they can run over every single change-point without
  concern for cost. Reserve token-costing image reads for triage (contact
  sheets) and for the handful of moments those two tools flag as needing a
  closer look.
