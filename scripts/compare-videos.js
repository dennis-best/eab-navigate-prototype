#!/usr/bin/env node
/**
 * compare-videos.js
 *
 * Automated pre/post regression gate: for every change-point timestamp,
 * extracts the matching frame from both videos.mp4 files and computes an
 * SSIM (structural similarity) score via ffmpeg's `ssim` filter - pure
 * ffmpeg, no AI tokens spent, until a mismatch is found.
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
 * Output: writes a JSON report (sorted worst-first) to reportPath, and
 * prints a summary. Any change-point below ssimThreshold should get a
 * full-resolution side-by-side look before declaring parity "done" -
 * that's the one step in this pipeline that costs tokens, and it's now
 * targeted only at genuinely-different moments.
 *
 * IMPORTANT - this is a relative triage heuristic, not an absolute
 * pass/fail gate: this prototype intentionally uses a different design
 * system (HI/P) than the original app's bespoke styling, so even a
 * correctly-matching frame typically scores ~0.65-0.75, not ~1.0. Treat the
 * default threshold as "worth a look", and pay closer attention to outliers
 * that score far below the typical range for that stretch of video (e.g.
 * <0.5) - those are more likely to be genuinely missing/wrong content
 * rather than just different button/table styling. The very first frame(s)
 * of a video (t=0) will also often score low due to fade-in/unstyled-flash
 * artifacts unrelated to real parity - not a bug.
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
  scored.sort((a, b) => a.ssim - b.ssim);

  const belowThreshold = scored.filter((r) => r.ssim < ssimThreshold);

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        originalVideo,
        prototypeVideo,
        ssimThreshold,
        chromeOffsetPx: ORIGINAL_CHROME_OFFSET_PX,
        total: results.length,
        belowThresholdCount: belowThreshold.length,
        failedToScore: failed.length,
        results: scored,
      },
      null,
      2
    )
  );

  console.log(`\n${scored.length}/${results.length} change-points scored (${failed.length} failed to score).`);
  console.log(`${belowThreshold.length} below threshold ${ssimThreshold} (worst first):`);
  for (const r of belowThreshold.slice(0, 30)) {
    console.log(`  t=${r.t.toFixed(2)}s  ssim=${r.ssim.toFixed(4)}`);
  }
  if (belowThreshold.length > 30) {
    console.log(`  ... and ${belowThreshold.length - 30} more (see ${reportPath})`);
  }
  console.log(`\nFull report: ${reportPath}`);

  if (belowThreshold.length > 0) {
    console.log(
      `\nNext step: for each flagged timestamp, pull a full-resolution side-by-side ` +
        `(e.g. ffmpeg -ss <t> -i <video> -vframes 1 -vf scale=1000:-1 out.jpg for both videos) ` +
        `and read it before declaring parity done. A low score can also mean an ` +
        `acknowledged/acceptable design difference, not necessarily a bug.`
    );
  }
})().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
