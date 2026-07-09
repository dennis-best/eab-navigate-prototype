// Records a Playwright walkthrough of demos/navigate-app.html that mirrors
// the VERIFIED second-by-second timeline of videos/original.mp4, derived from
// frame extraction (fps=1/3) and ffmpeg scene-change detection. Each action
// below is anchored to a measured timestamp in the original recording, not a
// guessed duration, to avoid cumulative drift.
// Output: videos/prototype.webm (converted to .mp4 by the caller via ffmpeg).

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEMO_PATH = path.join(PROJECT_ROOT, "demos", "navigate-app.html");
const VIDEO_DIR = path.join(PROJECT_ROOT, "videos");
const VIEWPORT = { width: 1600, height: 1050 };

let START;
let elapsedScripted = 0; // ms of scripted wait time consumed so far (post-load)

function log(msg) {
  const t = (Date.now() - START) / 1000;
  console.log(`[${t.toFixed(1)}s] ${msg}`);
}

// waitUntil(targetSeconds) waits just long enough that, cumulatively, we land
// on the target timestamp from the verified timeline (measured from t=0 of
// the original recording, i.e. right after LOAD_MS).
const TIME_SCALE = Number(process.env.TIME_SCALE) || 1; // for compressed smoke tests

async function waitUntil(page, targetSeconds) {
  const targetMs = targetSeconds * 1000 * TIME_SCALE;
  const remaining = targetMs - elapsedScripted;
  if (remaining > 0) {
    await page.waitForTimeout(remaining);
    elapsedScripted = targetMs;
  }
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

async function tryClick(page, selector, timeout = 2000) {
  try {
    await page.click(selector, { timeout });
  } catch (e) {
    /* ignore, keep pacing intact */
  }
}

async function tryHover(page, selector, timeout = 2000) {
  try {
    await page.hover(selector, { timeout });
  } catch (e) {
    /* ignore */
  }
}

async function run() {
  if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

  const browser = await chromium.launch();

  // Pre-warm the CDN-hosted HIF framework and hydrate a throwaway page first,
  // so the *recorded* page's load is served from cache and completes almost
  // instantly. This keeps the recording's t=0 tightly aligned with the
  // moment the UI is actually interactive, matching the original video's
  // timeline instead of drifting by however long the cold load took.
  const warmupContext = await browser.newContext({ viewport: VIEWPORT });
  const warmupPage = await warmupContext.newPage();
  await warmupPage.goto(`file://${DEMO_PATH}`, { waitUntil: "load" });
  await warmupPage.waitForFunction(
    () => document.querySelectorAll("hi-tab").length > 0,
    { timeout: 15000 }
  );
  await warmupPage.waitForTimeout(500);
  await warmupContext.close();

  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: VIDEO_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();

  await page.goto(`file://${DEMO_PATH}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.querySelectorAll("hi-tab").length > 0,
    { timeout: 15000 }
  );

  // START marks t=0 of the measured timeline, i.e. the moment the UI is
  // actually ready and visible — this is what the recorded video's t=0
  // should correspond to as closely as possible.
  START = Date.now();
  log("0:00 Staff Home > Students tab");

  // --- ~0:20-0:38 open List Type, Term, Relationship Type dropdowns ---
  await waitUntil(page, 20);
  log("0:20 Open List Type dropdown");
  await tryClick(page, "#filter-list-type");
  await waitUntil(page, 26);
  await tryClick(page, "#filter-list-type");

  await waitUntil(page, 28);
  log("0:28 Open Term dropdown");
  await tryClick(page, "#filter-term");
  await waitUntil(page, 33);
  await tryClick(page, "#filter-term");

  await waitUntil(page, 35);
  log("0:35 Open Relationship Type dropdown");
  await tryClick(page, "#filter-relationship");
  await waitUntil(page, 37.5);
  await tryClick(page, "#filter-relationship");

  // --- 0:38 Appointments tab ---
  await waitUntil(page, 38);
  log("0:38 Staff Home > Appointments tab");
  await clickTab(page, "appointments");

  // --- 0:54 open Care Unit dropdown ---
  await waitUntil(page, 54);
  log("0:54 Open Care Unit dropdown");
  await tryClick(page, "#upcoming-care-unit");
  await waitUntil(page, 58);
  await tryClick(page, "#upcoming-care-unit");

  // --- 1:05 My Availability tab ---
  await waitUntil(page, 65);
  log("1:05 Staff Home > My Availability tab");
  await clickTab(page, "availability");
  await page.mouse.wheel(0, 400);

  // --- 1:15 Appointment Queues tab ---
  await waitUntil(page, 75);
  log("1:15 Staff Home > Appointment Queues tab");
  await clickTab(page, "queues");

  // --- 1:26 Appointment Requests tab ---
  await waitUntil(page, 86);
  log("1:26 Staff Home > Appointment Requests tab");
  await clickTab(page, "requests");

  // --- 1:30-1:39 back to Students, search, navigate to James Wyatt ---
  await waitUntil(page, 90);
  log("1:30 Staff Home > Students tab, search for James Wyatt");
  await clickTab(page, "students");
  try {
    await page.fill("#top-nav__quick-search", "james");
  } catch (e) {
    /* ignore */
  }
  await waitUntil(page, 96);
  await clickTab(page, "appointments");
  await dispatchClick(page, ".goto-wyatt-link");

  // --- 1:39 James Wyatt Overview ---
  await waitUntil(page, 99);
  log("1:39 James Wyatt > Overview tab");

  // --- 1:59-2:13 Message Student panel ---
  await waitUntil(page, 119);
  log("1:59 Open Message Student panel");
  await tryClick(page, "text=Message Student");
  await waitUntil(page, 133);
  await tryClick(page, "text=Cancel");

  // --- 2:15 History tab ---
  await waitUntil(page, 135);
  log("2:15 James Wyatt > History tab");
  await clickTab(page, "jw-history");

  // --- 2:23 back to Overview ---
  await waitUntil(page, 143);
  log("2:23 James Wyatt > Overview tab");
  await clickTab(page, "jw-overview");

  // --- 2:30 hover Missed Success Markers tooltip (long dwell) ---
  await waitUntil(page, 150);
  log("2:30 Overview: hover Missed Success Markers");
  await tryHover(page, "text=Missed Success Markers");

  // --- 3:51 scroll to Categories/Tags/Custom Attributes ---
  await waitUntil(page, 231);
  log("3:51 Overview: scroll to Categories / Custom Attributes");
  await page.mouse.wheel(0, 1200);

  // --- 4:36 Success Progress tab ---
  await waitUntil(page, 276);
  log("4:36 James Wyatt > Success Progress tab");
  await clickTab(page, "jw-success");

  // --- 5:00 History tab (full activity feed) ---
  await waitUntil(page, 300);
  log("5:00 James Wyatt > History tab (full feed)");
  await clickTab(page, "jw-history");
  await page.mouse.wheel(0, 500);

  // --- 5:45 Courses tab ---
  await waitUntil(page, 345);
  log("5:45 James Wyatt > Courses tab");
  await clickTab(page, "jw-courses");
  await page.mouse.wheel(0, 600);

  // --- 6:38 Journeys tab ---
  await waitUntil(page, 398);
  log("6:38 James Wyatt > Journeys tab");
  await clickTab(page, "jw-journeys");

  // --- 6:42 open journey detail panel ---
  await waitUntil(page, 402);
  log("6:42 Open journey detail panel");
  await dispatchClick(page, "#journey-detail-link");

  // --- 7:10 Checklist tab ---
  await waitUntil(page, 430);
  log("7:10 James Wyatt > Checklist tab");
  await clickTab(page, "jw-checklist");

  // --- 7:26 Academic Plan tab ---
  await waitUntil(page, 446);
  log("7:26 James Wyatt > Academic Plan tab");
  await clickTab(page, "jw-academic-plan");

  // --- 7:51 back to Overview ---
  await waitUntil(page, 471);
  log("7:51 James Wyatt > Overview tab");
  await clickTab(page, "jw-overview");

  // --- 8:06 Conversations tab ---
  await waitUntil(page, 486);
  log("8:06 James Wyatt > Conversations tab");
  await clickTab(page, "jw-conversations");

  // --- 8:18 Staff Tasks tab (hold to end, ~8:34) ---
  await waitUntil(page, 498);
  log("8:18 James Wyatt > Staff Tasks tab (hold to end)");
  await clickTab(page, "jw-staff-tasks");

  await waitUntil(page, 514.6);

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
