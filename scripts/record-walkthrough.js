// Records a Playwright walkthrough of demos/navigate-app.html that mirrors
// the actual sequence/timing observed in videos/original.mp4 (reconstructed
// from 5-second frame sampling of the source recording).
// Output: videos/prototype.webm (converted to .mp4 by the caller via ffmpeg).

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEMO_PATH = path.join(PROJECT_ROOT, "demos", "navigate-app.html");
const VIDEO_DIR = path.join(PROJECT_ROOT, "videos");
const VIEWPORT = { width: 1600, height: 1050 };

// Target total runtime: ~515s to match videos/original.mp4.
// TIME_SCALE lets a smoke test compress everything proportionally.
const TIME_SCALE = Number(process.env.TIME_SCALE) || 1;

let START;
function log(msg) {
  const t = (Date.now() - START) / 1000;
  console.log(`[${t.toFixed(1)}s] ${msg}`);
}

async function wait(page, ms) {
  await page.waitForTimeout(Math.max(0, ms * TIME_SCALE));
}

async function clickTab(page, forId) {
  await page.click(`hi-tab[for="${forId}"]`);
}

// hi-link elements don't propagate Playwright's synthetic mouse clicks reliably,
// so dispatch a real "click" event instead.
async function dispatchClick(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, selector);
}

async function tryHover(page, selector, timeout = 2000) {
  try {
    await page.hover(selector, { timeout });
  } catch (e) {
    /* ignore, keep pacing intact */
  }
}

async function tryClick(page, selector, timeout = 2000) {
  try {
    await page.click(selector, { timeout });
  } catch (e) {
    /* ignore */
  }
}

async function run() {
  if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: VIDEO_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();

  START = Date.now();

  log("Loading prototype...");
  await page.goto(`file://${DEMO_PATH}`, { waitUntil: "load" });
  await wait(page, 4000); // let the remote HIF framework hydrate custom elements

  // ~0:00-0:25 Staff Home > Students tab (default view)
  log("Staff Home > Students tab");
  await wait(page, 21000);

  // ~0:25 open List Type dropdown
  log("Open List Type dropdown");
  await tryClick(page, "#filter-list-type");
  await wait(page, 5000);
  await tryClick(page, "#filter-list-type"); // close it again
  await wait(page, 2000);

  // ~0:30 open Term dropdown
  log("Open Term dropdown");
  await tryClick(page, "#filter-term");
  await wait(page, 5000);
  await tryClick(page, "#filter-term");
  await wait(page, 2000);

  // ~0:38 open Relationship Type dropdown
  log("Open Relationship Type dropdown");
  await tryClick(page, "#filter-relationship");
  await wait(page, 4000);
  await tryClick(page, "#filter-relationship");

  // ~0:40 Appointments tab
  log("Staff Home > Appointments tab");
  await clickTab(page, "appointments");
  await wait(page, 5000);

  // ~0:48 change Care Unit filter
  log("Change Care Unit filter");
  await tryClick(page, "#upcoming-care-unit");
  await wait(page, 3000);
  await tryClick(page, "#upcoming-care-unit");
  await wait(page, 4000);

  // ~0:55 My Availability tab
  log("Staff Home > My Availability tab");
  await clickTab(page, "availability");
  await wait(page, 10000);
  await page.mouse.wheel(0, 500);
  await wait(page, 15000);

  // ~1:20 Appointment Requests tab
  log("Staff Home > Appointment Requests tab");
  await clickTab(page, "requests");
  await wait(page, 10000);

  // ~1:30 back to Students, type into search box, navigate to James Wyatt
  log("Staff Home > Students tab, search for James Wyatt");
  await clickTab(page, "students");
  await wait(page, 2000);
  try {
    await page.fill("#top-nav__quick-search", "james");
  } catch (e) {
    /* ignore */
  }
  await wait(page, 4000);
  await clickTab(page, "appointments");
  await wait(page, 500);
  await dispatchClick(page, ".goto-wyatt-link");
  await wait(page, 4000);

  // ~1:50 James Wyatt Overview, open Message Student panel
  log("James Wyatt > Overview (Message Student panel)");
  await tryClick(page, "text=Message Student");
  await wait(page, 15000);
  await tryClick(page, "text=Cancel");
  await wait(page, 500);

  // ~2:15 History tab
  log("James Wyatt > History tab");
  await clickTab(page, "jw-history");
  await page.mouse.wheel(0, 600);
  await wait(page, 15000);

  // ~2:30 back to Overview
  log("James Wyatt > Overview tab");
  await clickTab(page, "jw-overview");
  await page.mouse.wheel(0, -600);
  await wait(page, 15000);

  // ~2:45 hover Course Grade D/F breakdown
  log("Overview: hover Course Grade D/F");
  await tryHover(page, "text=Course Grade D/F");
  await wait(page, 15000);

  // ~3:00-3:15 hover Missed Success Markers
  log("Overview: hover Missed Success Markers");
  await tryHover(page, "text=Missed Success Markers");
  await wait(page, 30000);

  // ~3:50 scroll to bottom of Overview
  log("Overview: scroll to Custom Attributes / Success Team");
  await page.mouse.wheel(0, 1400);
  await wait(page, 30000);

  // ~4:50 Success Progress tab
  log("James Wyatt > Success Progress tab");
  await clickTab(page, "jw-success");
  await wait(page, 30000);

  // ~5:20 History tab (full feed)
  log("James Wyatt > History tab (full feed)");
  await clickTab(page, "jw-history");
  await page.mouse.wheel(0, 400);
  await wait(page, 25000);

  // ~5:45 Courses tab
  log("James Wyatt > Courses tab");
  await clickTab(page, "jw-courses");
  await page.mouse.wheel(0, 600);
  await wait(page, 25000);

  // ~6:15 Journeys tab
  log("James Wyatt > Journeys tab");
  await clickTab(page, "jw-journeys");
  await wait(page, 15000);

  // ~6:30 open journey detail panel
  log("James Wyatt > Journeys detail panel");
  await dispatchClick(page, "#journey-detail-link");
  await wait(page, 25000);

  // ~7:15 Checklist tab
  log("James Wyatt > Checklist tab");
  await clickTab(page, "jw-checklist");
  await wait(page, 30000);

  // ~7:50 Academic Plan tab
  log("James Wyatt > Academic Plan tab");
  await clickTab(page, "jw-academic-plan");
  await wait(page, 20000);

  // ~8:10 Conversations tab
  log("James Wyatt > Conversations tab");
  await clickTab(page, "jw-conversations");
  await wait(page, 15000);

  // ~8:25 Staff Tasks tab, hold to end (~8:34)
  log("James Wyatt > Staff Tasks tab (hold to end)");
  await clickTab(page, "jw-staff-tasks");
  await wait(page, 9000);

  log("Recording complete, closing context...");
  await context.close();
  await browser.close();

  const files = fs
    .readdirSync(VIDEO_DIR)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => ({ f, t: fs.statSync(path.join(VIDEO_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

  if (files.length > 0) {
    const src = path.join(VIDEO_DIR, files[0].f);
    const dest = path.join(VIDEO_DIR, "prototype.webm");
    fs.renameSync(src, dest);
    log(`Saved recording to ${dest}`);
  } else {
    log("WARNING: no .webm file found in videos/");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
