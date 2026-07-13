#!/usr/bin/env node
/**
 * extract-changepoints.js
 *
 * Runs ffmpeg scene-change detection over a video and writes a JSON list of
 * timestamps where the on-screen content actually changed (dropdown opened,
 * tab switched, page navigated, etc). This replaces manually guessing
 * timestamps and reading full-resolution frames one at a time, which is both
 * expensive (per-image token cost) and unreliable (easy to miss a moment
 * that falls between guesses).
 *
 * Usage:
 *   node scripts/extract-changepoints.js <video-path> [outputJsonPath] [sceneThreshold]
 *
 * Example:
 *   node scripts/extract-changepoints.js videos/original.mp4 .tmp/changepoints/original.json 0.02
 *
 * Output JSON shape:
 *   [{ "t": 12.34, "score": 0.041 }, ...]
 *
 * Notes:
 * - IMPORTANT: ffmpeg's "scene" score is an average pixel-difference over the
 *   WHOLE frame. A UI change like a dropdown opening only affects a small
 *   region (10-20% of the screen), so the default ffmpeg-typical threshold
 *   (~0.02, tuned for video-editing cut detection) silently MISSES dropdown
 *   opens/closes and other partial-screen UI changes. Verified empirically on
 *   this project: threshold 0.02 produced zero change-points across an entire
 *   dropdown-interaction window (t=20-38s) that is known to contain multiple
 *   dropdown open/close events. Threshold 0.003 correctly captured them.
 * - Default here is therefore 0.003, tuned for desktop UI walkthrough videos
 *   with partial-screen changes (dropdowns, tooltips, small panels). Raise it
 *   (e.g. 0.01-0.02) only for full-page navigations/cuts, or if 0.003 is
 *   producing too much noise from incidental motion (e.g. a webcam bubble).
 * - t=0.0 is always included so the very first frame is never skipped.
 */

const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

function usageAndExit() {
  console.error(
    "Usage: node scripts/extract-changepoints.js <video-path> [outputJsonPath] [sceneThreshold]"
  );
  process.exit(1);
}

const videoPath = process.argv[2];
if (!videoPath || !fs.existsSync(videoPath)) {
  console.error(`Video not found: ${videoPath}`);
  usageAndExit();
}

const outputJsonPath =
  process.argv[3] ||
  path.join(
    ".tmp",
    "changepoints",
    path.basename(videoPath, path.extname(videoPath)) + ".json"
  );
const sceneThreshold = parseFloat(process.argv[4] || "0.003");

fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });

// showinfo prints pts_time for every frame that passes the scene filter.
// We parse stderr (ffmpeg logs showinfo to stderr) for pts_time values.
const args = [
  "-i",
  videoPath,
  "-vf",
  `select='gt(scene,${sceneThreshold})',showinfo`,
  "-vsync",
  "vfr",
  "-f",
  "null",
  "-",
];

console.log(`Running: ffmpeg ${args.join(" ")}`);

execFile("ffmpeg", args, { maxBuffer: 1024 * 1024 * 64 }, (err, stdout, stderr) => {
  // ffmpeg with -f null intentionally "errors" via non-zero in some builds
  // even on success, so parse stderr regardless of err.
  const timestamps = [0.0];
  const scores = [null];

  const ptsRegex = /pts_time:([\d.]+)/g;
  let match;
  while ((match = ptsRegex.exec(stderr)) !== null) {
    timestamps.push(parseFloat(match[1]));
  }

  // Dedup + sort
  const uniqueSorted = [...new Set(timestamps)].sort((a, b) => a - b);

  const changepoints = uniqueSorted.map((t) => ({ t }));

  fs.writeFileSync(outputJsonPath, JSON.stringify(changepoints, null, 2));

  console.log(
    `Found ${changepoints.length} change-points (threshold=${sceneThreshold}).`
  );
  console.log(`Written to ${outputJsonPath}`);

  if (changepoints.length < 5) {
    console.warn(
      "WARNING: very few change-points detected. Consider lowering sceneThreshold."
    );
  }
});
