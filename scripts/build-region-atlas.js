#!/usr/bin/env node
/**
 * build-region-atlas.js
 *
 * Static-layout companion to extract-changepoints.js / build-contact-sheets.js.
 * Those two exist to find MOTION (dropdown opens, tab switches) - they are
 * the "motion track" of the video-parity-audit workflow. This script serves
 * the "static track": at a small set of anchor timestamps (one per distinct
 * screen/state, not every change-point), it crops out each named UI region
 * at full, readable resolution so an agent can actually verify chrome that
 * never "changes" and therefore never shows up as a change-point at all -
 * things like a sidebar logo's position, or a page title's default styling.
 *
 * This exists because a real miss on this project - a mispositioned
 * institution logo and a page title with the wrong closed-state styling -
 * were both invisible to change-point detection and to SSIM comparison:
 * they were wrong on every single frame from t=0 onward, so nothing ever
 * "changed" to flag them, and small/local chrome differences don't move an
 * SSIM score enough to register against normal HI/P-vs-source styling
 * variance. Only a direct, readable crop of the relevant region catches it.
 *
 * Usage:
 *   node scripts/build-region-atlas.js <video-path> <regions-config.json> [outDir]
 *
 * Region config shape (JSON), coordinates in the source video's native
 * resolution (check with ffprobe -show_entries stream=width,height):
 *   {
 *     "anchors": [{ "screenId": "staff-home", "t": 0 }, ...],
 *     "regions": {
 *       "topNav":       { "x": 0,   "y": 0,   "w": 1600, "h": 64 },
 *       "pageHeader":   { "x": 0,   "y": 64,  "w": 1200, "h": 80 },
 *       "mainContent":  { "x": 0,   "y": 144, "w": 1200, "h": 906 },
 *       "rightSidebar": { "x": 1200,"y": 64,  "w": 400,  "h": 986 }
 *     }
 *   }
 *
 * Output: <outDir>/<screenId>/<regionName>.jpg for every anchor x region
 * combination (default outDir: .tmp/region-atlas). Pure ffmpeg, zero
 * AI-token cost - read the resulting crops directly, don't guess.
 */

const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 64 }, (err, stdout, stderr) => {
      resolve({ stdout, stderr, err });
    });
  });
}

async function extractRegion(videoPath, t, region, outPath) {
  const { x, y, w, h } = region;
  const scaleArg = w < 800 ? `,scale=${Math.round(w * (800 / w))}:-1` : "";
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
    `crop=${w}:${h}:${x}:${y}${scaleArg}`,
    "-y",
    outPath,
  ]);
}

async function main() {
  const [, , videoPath, configPath, outDirArg] = process.argv;

  if (!videoPath || !configPath) {
    console.error(
      "Usage: node scripts/build-region-atlas.js <video-path> <regions-config.json> [outDir]"
    );
    process.exit(1);
  }
  if (!fs.existsSync(videoPath)) {
    console.error("Video not found:", videoPath);
    process.exit(1);
  }
  if (!fs.existsSync(configPath)) {
    console.error("Region config not found:", configPath);
    process.exit(1);
  }

  const outDir = outDirArg || ".tmp/region-atlas";
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const { anchors, regions } = config;

  if (!Array.isArray(anchors) || anchors.length === 0) {
    console.error("Config must include a non-empty 'anchors' array.");
    process.exit(1);
  }
  if (!regions || Object.keys(regions).length === 0) {
    console.error("Config must include a non-empty 'regions' object.");
    process.exit(1);
  }

  let written = 0;
  for (const anchor of anchors) {
    const screenDir = path.join(outDir, anchor.screenId);
    fs.mkdirSync(screenDir, { recursive: true });

    for (const [regionName, region] of Object.entries(regions)) {
      const outPath = path.join(screenDir, `${regionName}.jpg`);
      await extractRegion(videoPath, anchor.t, region, outPath);
      written++;
    }
    console.log(`[${anchor.screenId}] t=${anchor.t}s -> ${Object.keys(regions).length} region crop(s)`);
  }

  console.log(`Wrote ${written} region crop(s) across ${anchors.length} screen(s) to ${outDir}/`);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
