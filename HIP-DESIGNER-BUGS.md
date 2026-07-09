# HI/P Designer — Maintainer Bug Log

Issues found while building static prototypes with the HI/P Designer bundle (v1.1.1). Share this file with the maintainers when convenient instead of reporting each item ad hoc.

**Project:** EAB Prototype  
**Demo affected:** `demos/navigate360-home.html` (Navigate360 Staff Home)

**Reference behavior:** Unless a future task says otherwise, static prototypes should match the **live Navigate360 Staff Home** UI (including responsive layout at desktop, tablet, and mobile widths). Live screenshots from 2026-07-06 are the baseline.

**Documentation:** [`PROTOTYPE-CONVENTIONS.md`](PROTOTYPE-CONVENTIONS.md) (what to log vs edit inline) · [`HIP-DESIGNER-OVERRIDES.md`](HIP-DESIGNER-OVERRIDES.md) (intentional design deviations only)

---

## How to use this log

| Column | Meaning |
|--------|---------|
| **ID** | Stable reference for follow-up |
| **Status** | `open` · `workaround` · `fixed-upstream` |
| **Severity** | `blocker` · `major` · `minor` |
| **Workaround** | What we did locally, if anything |

Add new rows at the top. When upstream fixes land, change status to `fixed-upstream` and note the version.

---

## Open issues

### HIP-006 — Letter-scale spacing utility classes (`mbm`, `mtl`, `pas`, ...) don't exist

| | |
|---|---|
| **Status** | `workaround` |
| **Severity** | `major` |
| **Found** | 2026-07-08 |
| **Component** | `@eab-eip` / `@eab-yip` spacing utility classes, all demos |

**Symptom:** Elements using letter-scale margin/padding classes (`mts`, `mtm`, `mtl`, `mbs`, `mbm`, `mbl`, `mrs`, `mrm`, `mrl`, `mls`, `pas`, `pal`, `pam`, `par`, etc.) render with **zero spacing** — no visual gap is ever applied, no matter which size letter is used.

**Cause:** Confirmed by downloading and grepping the actual loaded CSS bundles (`https://cdn.dev.eab.com/hif/latest/{core,baseline,ds,os}/prod.css`): none of these class names exist anywhere in them. Computed-style inspection confirms `margin-bottom: 0px` etc. on every element using them, everywhere in the app. These letter-scale names appear to be a stale/incorrect convention that never matched this HIF build.

**Real, working spacing system** (numeric scale, confirmed present in `ds/prod.css`):

- Margin: `.mt-N`, `.mb-N`, `.ml-N`, `.mr-N`, `.ma-N` (all sides)
- Padding: `.pt-N`, `.pb-N`, `.pl-N`, `.pr-N`, `.pa-N` (all sides)
- `N` is `0`–`11`, mapped to a `--hi-sz-N` token scale:

| N | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|----|----|
| px | 0 | 1 | 2 | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 |

Some demo code already correctly used this real system (e.g. `class="pl-8 pr-8 pb-8"` in `navigate360-home.html`, `navigate-app.html`, `gmt-walkthrough.html`) — those spots always rendered fine, which is what exposed the mismatch.

**Translation table used to fix existing demos:**

| Fake class | Real replacement | px |
|---|---|---|
| `mts` / `mtm` / `mtl` | `mt-4` / `mt-6` / `mt-8` | 8 / 16 / 24 |
| `mbs` / `mbm` / `mbl` | `mb-4` / `mb-6` / `mb-8` | 8 / 16 / 24 |
| `mrs` / `mrm` / `mrl` | `mr-4` / `mr-6` / `mr-8` | 8 / 16 / 24 |
| `mls` / `mlm` / `mll` | `ml-4` / `ml-6` / `ml-8` | 8 / 16 / 24 |
| `pas` / `pam` / `pal` (all-sides usage) | `pa-4` / `pa-6` / `pa-8` | 8 / 16 / 24 |
| `pal` / `par` (one-off side usage, no size letter) | `pl-6` / `pr-6` | 16 |

Other utility attributes/classes used across the demos — `l-kind`, `l-width-fixed`, `l-align`, `l-justify`, `clr-gray_NN-bkg`, `clr-white-bkg`, `text-center` — **are real** and confirmed present; no changes needed for those.

**Workaround:** Use the real numeric-scale classes directly instead of the letter-scale names. Swept all demos in this repo on 2026-07-08.

**Suggested fix:** Update the HI/P Designer bundle's reference docs/examples (`design-index.md`, `design-screenshots.md`, `hip-index.md`) so they don't teach the nonexistent letter-scale convention.

---

### HIP-001 — HIF bootstrap CDN path 404

| | |
|---|---|
| **Status** | `workaround` |
| **Severity** | `blocker` |
| **Found** | 2026-07-06 |
| **Component** | `.cursor/hip/index-template.html` |

**Symptom:** Demos render as unstyled plain text; custom elements never upgrade.

**Cause:** Template references `https://cdn.dev.eab.com/hif/1.1.1/index.js`, which returns HTTP 404 (`NoSuchKey`).

**Workaround:** Use `https://cdn.dev.eab.com/hif/latest/index.js` instead (returns 200).

**Suggested fix:** Publish `1.1.1` to CDN or update the designer bundle template to pin a URL that exists.

---

### HIP-002 — `left_main_right` without `left` region hides `right` rail

| | |
|---|---|
| **Status** | `open` |
| **Severity** | `major` |
| **Found** | 2026-07-06 |
| **Component** | `@eab-yip/yi-blueprint` layout screen `left_main_right` |
| **Reference** | `ds/examples/layouts_styles/blueprint_left_main_right.html` |

**Symptom:** Staff Home–style pages (tertiary nav + main + right sidebar, no separate `left` content column) show main content only; the entire `x-region="right"` stack is absent from the layout.

**Expected:** Tertiary navigation occupies the left icon rail; `main` and `right` regions should still render (as in production Navigate360).

**Actual:** With `x-layout-screen="left_main_right"` and only `navigation-tertiary`, `main`, and `right` children, the right region does not appear.

**Workaround:** Switch to `x-layout-screen="main_right"` (see HIP-003).

---

### HIP-003 — `main_right` + tertiary nav: right rail clipped by overflow

| | |
|---|---|
| **Status** | `workaround` |
| **Severity** | `major` |
| **Found** | 2026-07-06 |
| **Component** | `@eab-yip/yi-blueprint` layout screen `main_right` + navigation |

**Symptom:** Right sidebar appears but is squeezed to a few pixels wide; tile titles truncate (`Profi…`, `Acti…`); content is clipped at the viewport edge. Screen-level container behaves as if `overflow: hidden` with no horizontal scroll.

**Likely cause:** Wide main content (e.g. multi-column table) expands the main region; combined with tertiary nav width, total layout exceeds the screen while the blueprint screen host clips overflow instead of scrolling within `main`.

**Workarounds applied in demo:**

1. Align DOM with canonical blueprint: `x-layout-system="blueprint"` on `<body>`, single `<main id="app" x-area="screen">` (avoid nested `<main>` + wrapper `<div>`).
2. Set `region-width="1/3"` on the screen for a wider right column.
3. Add `scroll-x="auto"` on the main zone wrapping the table.
4. Trim table columns and wrap long cell text in `<hi-reveal>`.

**Suggested fix:** Document the correct layout for “tertiary nav + main + right (no left region)” or make `main_right` constrain/shrink main content when nav is present. Consider whether `left_main_right` should treat tertiary nav as satisfying the `left` slot when no `x-region="left"` is present.

---

### HIP-004 — Template shell nesting differs from blueprint examples

| | |
|---|---|
| **Status** | `workaround` |
| **Severity** | `minor` |
| **Found** | 2026-07-06 |
| **Component** | `.cursor/hip/index-template.html` vs `yi-blueprint/layout_area/screen.md` |

**Symptom:** Extra wrapper (`<main id="app"><div x-layout-system>…<main x-area="screen">`) may interfere with region width calculations.

**Canonical pattern (from docs):**

```html
<body x-layout-system="blueprint" x-hosting="owner">
  <main x-area="screen" x-hosting="screen" x-layout-screen="…">
    <!-- regions -->
  </main>
</body>
```

**Template pattern:**

```html
<body>
  <main id="app">
    <div x-layout-system="blueprint" x-hosting="owner">
      <main x-area="screen" …>
```

**Workaround:** Put `x-layout-system` / `x-hosting` on `<body>` and merge screen attributes onto `<main id="app">`.

**Suggested fix:** Update `index-template.html` to match the documented screen shell while keeping `<main id="app">` as the screen host.

---

### HIP-005 — Static prototype parity gaps vs live Navigate360 Staff Home

| | |
|---|---|
| **Status** | `open` |
| **Severity** | `major` |
| **Found** | 2026-07-06 |
| **Component** | HI/P static designer + blueprint layout + navigation |

**Symptom:** Prototype diverges from live site at multiple breakpoints (desktop right-rail width/clipping, mobile right-rail stacking, nav icon set, table Actions dropdown, search placeholder, term label, etc.).

**Live behavior to match:**

| Breakpoint | Expected |
|---|---|
| Desktop | Tertiary nav + main table + right rail (~25% width) side by side; school icon overlaps header/right rail |
| Tablet / narrow | Tertiary nav visible; right rail stacks below main content (full width) |
| Mobile | Hamburger primary nav; filters wrap/stack; table scrolls horizontally; right-rail tiles stack below table |

**Workarounds applied in demo:**

- Nav-360 secondary pattern from `hi-navigation` visual guide (left-controls flyout icons, search placeholder, account avatar picture)
- `main_right` + `region-width="1/4"`; table wrapper uses `scroll-x="auto"`
- Tertiary icon set expanded; Actions dropdown above table; Spring 2026 term

**Suggested fix:** Ship a canonical Navigate360 Staff Home sample in the designer bundle with documented responsive layout for “tertiary + main + right (no left region).”

---

## Fixed upstream

*(None yet.)*

---

*Last updated: 2026-07-06*
