<p align="center">
  <img src="demos/assets/shared/eab-logo.png" alt="EAB" width="72" height="72">
</p>

# EAB Prototype Demos

A collection of static HI/P prototype demos built for EAB, each recreating a real
product recording as a working, click-through prototype for review and comparison.

## Quick Start

**No download, no login, no technical setup needed.**

Just click this link and it opens in your browser like any website:

### [**→ View the demos here ←**](https://dennis-best.github.io/eab-navigate-prototype/)

Once it's open, click on any demo listed to try it out. Everything is clickable, just like the real product.

---

**Requires:** [EAB Demo Builder](https://github.com/theforage/eab-demo-builder) — the Cursor
extension that builds and updates these prototypes from walkthrough videos (`/demo-build`,
`/demo-compare`, `/demo-update`). Install it per that repo's README before using the commands below.
This is only needed if you're building or editing prototypes, not for simply viewing them.

## Demos

### Demo 1: Navigate360 Staff Home

A static HI/P recreation of the Navigate360 Staff Home experience (Assigned
Students, Appointments, Appointment Queues, Appointment Requests, and the
James Wyatt student profile), built to match an original screen recording.

- [View prototype](demos/navigate-app.html)
- [View proof of concept](demos/proof-of-concept.html) &mdash; side-by-side comparison of the
  original recording against the prototype

## Viewing locally

Open [index.html](index.html) in a browser, or open any demo's HTML file directly
(e.g. `demos/navigate-app.html`).

## Building or updating a demo

With [EAB Demo Builder](https://github.com/theforage/eab-demo-builder) installed, open this repo in
Cursor and run `/demo-build`. Each demo has its own subfolder under `videos/` and `config/` (named
to match its `demos/<name>.html` file), e.g. for Demo 1:

- `videos/navigate-staff-home/original.mp4` - source recording read by the video prep step
- `config/navigate-staff-home/regions.json` - optional static chrome checks
- `config/navigate-staff-home/walkthrough.json` - drives the optional `/demo-compare` comparison
  page, which writes `videos/navigate-staff-home/prototype.mp4`

Shared visual assets (e.g. the EAB logo) live in `demos/assets/shared/`; demo-specific assets
(e.g. a demo's profile photos) live in `demos/assets/<name>/`.
