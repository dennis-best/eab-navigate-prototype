# Prototype conventions

How we document differences between **live Navigate360**, **HI/P static demos**, and **intentional design experiments** — without one file becoming a changelog of every name, photo, or mock row.

---

## Three buckets

| Bucket | What belongs here | Where it’s documented |
|--------|-------------------|------------------------|
| **Bugs** | HI/P designer, CDN, layout engine, or template is wrong | [`HIP-DESIGNER-BUGS.md`](HIP-DESIGNER-BUGS.md) |
| **Design overrides** | You *want* the UI to look or behave differently from live (layout, components, flows) | [`HIP-DESIGNER-OVERRIDES.md`](HIP-DESIGNER-OVERRIDES.md) |
| **Prototype content & interaction** | Sample data, labels, avatars, row counts, stubbed clicks — normal demo filler | **This file** (conventions only) + the demo HTML itself |

**Default:** Match live visually and structurally unless a **design override** says otherwise or you give a one-off instruction in chat.

---

## Do not log in the overrides file

These change often as you iterate. They live in the demo markup (and optionally in chat). **No OVR entry needed.**

- User display name, initials, avatar URL, profile photo
- Student/staff names, IDs, GPA, categories, row count
- Term labels, filter defaults, pagination numbers
- Search suggest list items
- Link `href`s pointing at `#` or fake routes
- Copy tweaks that don’t change layout or component choice
- Adding/removing **realistic mock rows** in a table
- Wiring **presentational** interactions (tabs that don’t swap views, dropdowns with static items, sort icons with no sort logic)

Think of it as: *if swapping the value wouldn’t surprise a maintainer reviewing the HTML, it’s content — not an override.*

---

## Prototype content & interaction (expected norms)

Static demos in `demos/` are **not** the app. Unless you ask for more:

| Area | Convention |
|------|------------|
| **Data** | Hard-coded sample data; counts may echo live (e.g. “401 total results”) for realism |
| **Auth / user** | Fictional user; any photo URL or initials are placeholders |
| **Navigation** | Icons and labels mirror live; targets are `#` or hash routes unless specified |
| **Flyouts / modals** | Omitted or shell-only unless the task is to prototype that surface |
| **Forms / filters** | Show default selections; no persistence or API |
| **Tables** | Sort/filter/actions may be visual only |

When you **add** interactions or data for a walkthrough, edit the demo file directly. Describe the scenario in your task (“use Jane Doe as the advisor”) — that’s enough context without a log entry.

---

## When to add a design override (`OVR-###`)

Log only when the difference is **meaningful for design review or handoff**:

- Layout region, breakpoint behavior, or shell structure differs from live **on purpose**
- Different HI/P component or pattern than live uses for the same job
- Deliberate UX experiment (e.g. “right rail always visible on mobile”)
- Temporary **structural** workaround you want reviewers to know about (link to bug ID)

**Do not log:** bug workarounds that belong in [`HIP-DESIGNER-BUGS.md`](HIP-DESIGNER-BUGS.md) unless the workaround is also a lasting design choice.

---

## When to add a bug (`HIP-###`)

- Template/CDN/HIF broken
- Documented layout API doesn’t match behavior
- Designer bundle missing samples you need

Workarounds go in the bug entry; revert when upstream fixes ship.

---

## Per-demo notes (optional)

If a demo needs a short scenario blurb (persona, task flow, “what we’re testing”), add a comment at the top of the HTML inside `<main id="app">`:

```html
<!-- Demo scenario: Staff advisor Sarah reviewing assigned students, Spring 2026 -->
```

Use a separate `demos/<name>.notes.md` only if the scenario is too long for a comment — still **not** an overrides entry.

---

## Quick decision tree

```
Does something feel wrong in HI/P or the template?
  → HIP-DESIGNER-BUGS.md

Are we intentionally designing something different from live?
  → HIP-DESIGNER-OVERRIDES.md

Are we just filling in names, data, photos, or stub interactions?
  → Edit the demo HTML; no log entry
```

---

*Last updated: 2026-07-06*
