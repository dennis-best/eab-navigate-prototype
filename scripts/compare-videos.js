#!/usr/bin/env node
/**
 * compare-videos.js
 *
 * Choreography drift detector, NOT a parity gate. For every change-point
 * timestamp, extracts the matching frame from both video files and computes
 * an SSIM (structural similarity) score via ffmpeg's `ssim` filter - pure
 * ffmpeg, no AI tokens spent.
 *
 * This prototype intentionally uses a different design system (HI/P) than
 * the original app's bespoke styling, so even a functionally-perfect,
 * correctly-matching frame typically scores ~0.65-0.75, not ~1.0. SSIM is
 * also too coarse to reliably catch a small, local, ALWAYS-present error
 * (e.g. a sidebar logo pinned to the wrong corner, or a page title with the
 * wrong closed-state styling) - those never register as an outlier here
 * because they don't move the score much against normal styling variance,
 * and because they're wrong on every frame rather than being a "different"
 * frame relative to some other reference. Catching that class of miss is
 * the job of the static track (scripts/build-region-atlas.js), not this
 * script - see the video-parity-audit skill.
 *
 * The one thing this script IS good for: spotting timeline/tab-sequencing
 * drift - a whole stretch of consecutive low scores can mean the recording
 * script's assumed choreography (which tab is active at second N) no longer
 * matches the source video's actual order. The report below flags
 * consecutive-low-score clusters separately from isolated outliers for
 * exactly this reason.
 *
 * The original video includes real browser chrome (tabs/address bar/
 * bookmarks) above the app content, while the prototype recording (Playwright)
 * starts directly at the app content. ORIGINAL_CHROME_OFFSET_PX crops that
 * chrome off the original frame before comparing, so both frames start at
 * the same "WOODLEY COLLEGE" app bar. This offset was measured empirically
 * and assumes both videos keep a fixed browser/viewport size throughout - if
 * either video's chrome height changes, re-measure it.
 *
 * Usage:
 *   node scripts/compare-videos.js <original-video> <prototype-video> <changepoints-json> [reportPath] [ssimThreshold]
 *
 * Output: writes a JSON report (sorted worst-first, plus detected clusters)
 * to reportPath, and prints a summary. Do not chase the absolute score to
 * zero flagged timestamps or treat a clean report as "static layout is
 * correct" - it isn't evidence of that either way. Use it only to decide
 * whether a stretch of the re-recorded prototype drifted out of choreography
 * with the source video.
 */

const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ORIGINAL_CHROME_OFFSET_PX = 113;
const COMPARE_WIDTH = 1000;
const COMPARE_HEIGHT = 650;

const [
  ,
  ,
  originalVideo,
  prototypeVideo,
  changepointsPath,
  reportArg,
  thresholdArg,
] = process.argv;

if (!originalVideo || !prototypeVideo || !changepointsPath) {
  console.error(
    "Usage: node scripts/compare-videos.js <original-video> <prototype-video> <changepoints-json> [reportPath] [ssimThreshold]"
  );
  process.exit(1);
}
for (const p of [originalVideo, prototypeVideo, changepointsPath]) {
  if (!fs.existsSync(p)) {
    console.error("Not found:", p);
    process.exit(1);
  }
}

const reportPath = reportArg || ".tmp/compare-videos/report.json";
const ssimThreshold = parseFloat(thresholdArg || "0.6");

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 64 }, (err, stdout, stderr) => {
      resolve({ stdout, stderr, err });
    });
  });
}

async function extractAligned(videoPath, t, cropTopPx, outPath) {
  // Force an identical output size regardless of source aspect ratio so
  // ffmpeg's ssim filter (which requires matching dimensions) can run -
  // this distorts slightly but is fine for a similarity heuristic.
  const vf =
    cropTopPx > 0
      ? `crop=iw:ih-${cropTopPx}:0:${cropTopPx},scale=${COMPARE_WIDTH}:${COMPARE_HEIGHT}`
      : `scale=${COMPARE_WIDTH}:${COMPARE_HEIGHT}`;
  await run("ffmpeg", [
    "-ss",
    String(t),
    "-i",
    videoPath,
    "-update",
    "1",
    "-vframes",
    "1",
    "-vf",
    vf,
    "-y",
    outPath,
  ]);
}

async function ssimScore(imgA, imgB) {
  const { stderr } = await run("ffmpeg", [
    "-i",
    imgA,
    "-i",
    imgB,
    "-filter_complex",
    "ssim",
    "-f",
    "null",
    "-",
  ]);
  const match = stderr.match(/All:([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

(async () => {
  const changepoints = JSON.parse(fs.readFileSync(changepointsPath, "utf8"));
  const timestamps = changepoints.map((c) => c.t);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "compare-videos-"));

  const results = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const origPath = path.join(tmpDir, "orig.jpg");
    const protoPath = path.join(tmpDir, "proto.jpg");

    await extractAligned(originalVideo, t, ORIGINAL_CHROME_OFFSET_PX, origPath);
    await extractAligned(prototypeVideo, t, 0, protoPath);

    const score = await ssimScore(origPath, protoPath);
    results.push({ t, ssim: score });

    if (i % 50 === 0) console.log(`Compared ${i + 1}/${timestamps.length} (t=${t}s)`);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });

  const scored = results.filter((r) => r.ssim !== null);
  const failed = results.filter((r) => r.ssim === null);
  const byTime = [...scored].sort((a, b) => a.t - b.t);

  const belowThreshold = [...scored].sort((a, b) => a.ssim - b.ssim).filter((r) => r.ssim < ssimThreshold);

  // A cluster is 3+ consecutive (by timestamp order) below-threshold points -
  // a signal of timeline/choreography drift over isolated single-frame noise.
  const clusters = [];
  let current = [];
  for (const r of byTime) {
    if (r.ssim < ssimThreshold) {
      current.push(r);
    } else {
      if (current.length >= 3) clusters.push(current);
      current = [];
    }
  }
  if (current.length >= 3) clusters.push(current);

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        purpose: "choreography-drift-detector, not a parity gate - see script header",
        originalVideo,
        prototypeVideo,
        ssimThreshold,
        chromeOffsetPx: ORIGINAL_CHROME_OFFSET_PX,
        total: results.length,
        belowThresholdCount: belowThreshold.length,
        failedToScore: failed.length,
        possibleChoreographyDriftClusters: clusters.map((c) => ({
          startT: c[0].t,
          endT: c[c.length - 1].t,
          count: c.length,
        })),
        results: belowThreshold,
      },
      null,
      2
    )
  );

  console.log(`\n${scored.length}/${results.length} change-points scored (${failed.length} failed to score).`);
  console.log(`${belowThreshold.length} below threshold ${ssimThreshold} (worst first) - not a fail count, just a shortlist to look at:`);
  for (const r of belowThreshold.slice(0, 30)) {
    console.log(`  t=${r.t.toFixed(2)}s  ssim=${r.ssim.toFixed(4)}`);
  }
  if (belowThreshold.length > 30) {
    console.log(`  ... and ${belowThreshold.length - 30} more (see ${reportPath})`);
  }

  if (clusters.length > 0) {
    console.log(`\n${clusters.length} possible CHOREOGRAPHY DRIFT cluster(s) (3+ consecutive low scores):`);
    for (const c of clusters) {
      console.log(`  t=${c[0].t.toFixed(2)}s - t=${c[c.length - 1].t.toFixed(2)}s (${c.length} points)`);
    }
    console.log(
      `  These are worth a full-resolution side-by-side check first - they more likely mean the ` +
        `recording script's tab/step timing has drifted from the source video's actual order, ` +
        `rather than isolated content bugs.`
    );
  }

  console.log(`\nFull report: ${reportPath}`);
  console.log(
    `\nReminder: this script cannot detect static chrome/layout errors (e.g. a misplaced logo, ` +
      `wrong title styling) that are wrong on every frame - use scripts/build-region-atlas.js for ` +
      `that. A clean report here is not evidence that static layout is correct.`
  );
})().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
