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
- [ ] Step 2: Build contact sheets from the change-points
- [ ] Step 3: Triage contact sheets, note interesting timestamps
- [ ] Step 4: Pull targeted full-resolution frames for interesting timestamps
- [ ] Step 5: Cross-reference against the prototype HTML and fix real gaps
- [ ] Step 6: Re-render the prototype recording and spot-verify
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

Writes grid images to `.tmp/contact-sheets/sheet-NN.jpg` (default 30
thumbnails per sheet, 6 columns) plus `manifest.json` mapping every grid tile,
in row-major order, to its exact source timestamp.

### Step 3: Triage

Read each `sheet-NN.jpg` with the Read tool. One image read covers ~30
moments. Look for state changes: a dropdown opening, a chart appearing, a
table populating, a tab switching. Note the approximate tile position and
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

### Step 6: Re-verify

After fixing, re-run the prototype's recording script and spot-check a few of
the same timestamps in the new prototype recording against the original.

## Efficiency notes

- 25fps video over ~500s is ~12,500 raw frames. Change-point detection
  typically reduces this to a few hundred meaningful moments — roughly a
  15-40x reduction before any images are even read.
- Reading one 30-tile contact sheet costs roughly what reading one normal
  single-frame screenshot costs, not 30x that. Most of the review should
  happen at the contact-sheet level; only drop to full-resolution single
  frames for moments that actually need precise text/data reading.
