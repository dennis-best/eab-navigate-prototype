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

## This is a mandatory, enforced process, not an optional checklist

This skill was rewritten after repeated partial audits produced a stream of
"one more thing you missed" corrections (dropdown search boxes, missing
default filter values, un-rendered checkbox labels, a table that quietly
capped out at 2 rows despite claiming "401 total results" via pagination).
Every one of those had a common cause: the audit was scoped to *whatever had
just been pointed out* instead of being exhaustive and reading real component
contracts. The rules below close those gaps. Do not skip steps to save time —
skipping is what caused the repeat misses in the first place.

## Workflow

```
Task Progress:
- [ ] Step 1: Extract change-points from the ENTIRE source video (no sampled windows)
- [ ] Step 2: Build contact sheets (thumbnail + auto diff-crop per tile) from the change-points
- [ ] Step 3: Triage every contact sheet, note every distinct screen/state
- [ ] Step 4: Pull targeted full-resolution frames for interesting timestamps
- [ ] Step 5: Read real component contracts before asserting how anything behaves
- [ ] Step 6: Run the full per-screen, all-element-type checklist against the prototype
- [ ] Step 7: Fix every real gap in one pass, including data extrapolation and filter consistency
- [ ] Step 8: Re-render the prototype recording
- [ ] Step 9: Run the SSIM regression gate against the prototype recording and fix anything flagged
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

### Step 5: Read real component contracts — never guess

Before asserting how any component behaves (a select, combobox, table,
chart, checkbox, tabs, tiles, icons — anything), read its actual doc, not
just a catalog/index file that only lists filenames. For this design system
the real per-component contracts live at:

```
/Users/dennisbest/Library/Application Support/Cursor/User/globalStorage/eab-hip.hip-designer/kb-design-cache/kb-design/ds/markdown/@eab-eip/<component>/visual_guide.md
```

Two failure modes this specifically prevents, both of which happened on this
project before this rule was enforced:
- Treating `hi-select[allow-key-search]` as "a visible search box" (it's
  actually silent keyboard type-ahead — no visible input). The real
  documented component for a visible search input with grouped/headed
  options is `hi-combobox`, using `input='[{"title":...,"value":...},
  {"title":"Heading","heading":true}, ...]'`.
- Assuming `<hi-checkbox>Some Label</hi-checkbox>` renders a visible label
  from its slotted text. It does not — `hi-checkbox`'s shadow DOM has no
  slot for it; the label never appears no matter how long you wait or
  what you click. The documented pattern is a **separate sibling
  `<hi-label for="...">`** (wrap both in `hi-input-group
  layout-mode="input-label"` for horizontal layout). Any
  `<hi-checkbox>text</hi-checkbox>` in this codebase is a bug, not a style
  choice.

**Render-test anything ambiguous** instead of trusting doc prose alone:
render both candidate variants locally with Playwright, screenshot the
relevant state (e.g. an open dropdown), and compare against the matching
video frame. Concrete example: docs describe `hi-select[aesthetic="dropdown"]`
as having "no visual indicator" for the selected option, but a render test
showed it actually does highlight the selected item by default — settled by
evidence, not by re-reading the prose more carefully.

**Known hidden-tab rendering bug**: a `hi-select` with `selected-index="0"`
+ `<hi-option selected>` mounted inside an initially-`hidden` `hi-case` (any
tab that isn't the default active one) silently fails to display its
closed-state label text — internal `selectedIndex` is correct, but
`hi-dropdown`'s `values` array stays `[]` and the box renders empty. This is
NOT fixable by re-triggering clicks/opens after the fact. The robust fix:
use `mode="value"` with an explicit `value="..."` attribute (and
`value="..."` on each `<hi-option>`) instead of `selected-index`/`selected`
— this pattern renders correctly regardless of initial visibility. Any
`hi-select` that drives a default-visible filter should use this pattern,
not the ambiguous `selected-index` + `selected` combination.

### Step 6: Full per-screen, all-element-type checklist

Do not scope the audit to "the thing that was just complained about." For
every screen/state found in Step 3, check every element type that's present,
against the matching video frame(s):

- **Interactive controls** (dropdowns/selects/comboboxes): search input
  present? selected-item highlighted? grouped/headed options? exact option
  text/order, including real duplicates? if it's a filter over a
  table/list/chart, does the default selection and the data shown agree
  with each other (see filter-consistency rule below)?
- **Tables**: exact columns, sort affordances, row data, pagination — and if
  a count/pager implies more rows than are directly visible, extrapolate
  plausible additional rows to match that implied scale (see data rule
  below).
- **Charts**: chart type, axes, data shown — not a placeholder table where
  the video shows a chart, or vice versa.
- **Icons/logos**: real brand marks vs generic icons (see brand-asset rule
  below).
- **Text/labels/counts**: exact copy, not paraphrased or approximated.
- **Images/photos**: matches what's in the video where identity matters.
- **Layout/structure**: sections present/absent, ordering, panel placement.

**HIP is a toolkit, not a ceiling.** If a documented component matches
what's on tape, use it (from the real docs, not a guess). If nothing in the
design system matches, do not skip it, approximate it away, or stop and wait
for permission — build it with plain HTML/CSS/JS so the prototype actually
replicates the video. Note afterward (informationally) that a piece was
custom-built outside the design system; that note doesn't block continuing.
The only case that still warrants pausing to ask is a real brand/logo asset
you don't have the actual file for.

**Data rule**: where the video directly shows data, copy it exactly — don't
paraphrase or "clean it up," including apparent glitches like real duplicate
entries. Where the UI *implies* more data exists than is directly visible
(a pager showing "401 total results" while only 2 rows are ever fully
readable on tape, a scrollbar implying more list items, etc.), extrapolate
enough additional plausible rows/items to back that implied scale, using the
visible entries as the template for columns/format/value ranges — don't
leave it artificially sparse just because that's all that was directly
readable.

**Filter-consistency rule**: a dropdown/toggle/tab that filters a
table/list/chart is not a decorative, standalone control — its default
selected value and the data shown beneath it must agree with each other (the
right kind/count of rows for that specific selection, not a generic
dataset), and if the video shows the same filter changed to a different
value producing different results, the prototype's data should differ
between those states too, not stay identical regardless of selection. Audit
the control and the data it filters as one unit, not separately.

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

### Step 7: Fix every real gap in one pass

Fix everything found in Step 6 together, not one complaint at a time — that
one-at-a-time pattern is exactly what this rewrite exists to stop.

### Step 8: Re-render

Re-run the prototype's recording script to produce a new prototype video.

### Step 9: SSIM regression gate (mandatory before declaring "done")

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
- **Watch for tab-sequencing/timeline drift, not just content gaps**: a
  cluster of consecutive low scores across a whole stretch (rather than one
  isolated frame) can mean the recording script's assumed choreography
  (which tab is active at second N) no longer matches the source video's
  actual order — a different failure mode than a missing element, and one
  content fixes alone won't resolve. Pull full-resolution frames from both
  videos at a couple of timestamps in that stretch to tell which case it is
  before fixing anything.

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
