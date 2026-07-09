# HI/P Designer — Design overrides log

**Intentional design and layout choices** that differ from live Navigate360 or from documented HI/P patterns.

This file stays **small**. It is not for mock data, usernames, profile photos, or stub interactions — see [`PROTOTYPE-CONVENTIONS.md`](PROTOTYPE-CONVENTIONS.md).

| File | Purpose |
|------|---------|
| [`HIP-DESIGNER-BUGS.md`](HIP-DESIGNER-BUGS.md) | Tooling/layout defects + forced workarounds |
| [`PROTOTYPE-CONVENTIONS.md`](PROTOTYPE-CONVENTIONS.md) | What to log vs what to edit inline in demos |
| **This file** | Deliberate design deviations only |

**Default:** Match live unless an `OVR-###` entry exists here or you instruct otherwise in chat.

---

## How to use

| Field | Meaning |
|-------|---------|
| **ID** | `OVR-###` |
| **Status** | `active` · `temporary` · `reverted` |
| **Live** | What production does |
| **Override** | What the prototype does |
| **Why** | Design or handoff reason |

Add entries at the top. Mark `reverted` when removed.

---

## Active overrides

### OVR-001 — Layout shell and region sizing (workaround-backed)

| | |
|---|---|
| **Status** | `temporary` |
| **Demo** | `demos/navigate360-home.html` |
| **Added** | 2026-07-06 |
| **Related bugs** | [HIP-002](HIP-DESIGNER-BUGS.md#hip-002--left_main_right-without-left-region-hides-right-rail), [HIP-003](HIP-DESIGNER-BUGS.md#hip-003--main_right--tertiary-nav-right-rail-clipped-by-overflow) |

**Live:** Tertiary nav + main + right rail with Micro-managed responsive stacking.

**Override:**

- `x-layout-screen="main_right"` + `region-width="1/4"`
- Blueprint attrs on `<body>` / `<main id="app">` instead of bundled template nesting
- Table wrapper uses `scroll-x="auto"`

**Why:** Closest static approximation until the designer bundle ships a canonical Staff Home layout sample. Revisit when HIP-002/003 are fixed.

---

## Planned design experiments

Deliberate product/UX changes **different from live** (not content swaps):

| ID | Demo | Change | Rationale |
|----|------|--------|-----------|
| — | — | *(none yet)* | — |

---

## Reverted

*(None yet.)*

---

*Last updated: 2026-07-06*
