#!/usr/bin/env node
/**
 * diff-region.js
 *
 * Given a video and two timestamps (a "before" and "after"), computes the
 * exact pixel region that changed between them using ffmpeg's blend=difference
 * + bbox filters (pure ffmpeg, no AI tokens spent), then writes a tightly
 * cropped, upscaled image of just that region from the "after" frame.
 *
 * This exists because contact-sheet thumbnails are small enough that a
 * change in one corner of the screen (e.g. a small dropdown menu appearing
 * near a page title) is easy to miss visually when there's other, larger
 * motion elsewhere in the same frame. This script removes the guesswork:
 * it points directly at the changed pixels instead of relying on a human
 * (or model) noticing them in a full/small screenshot.
 *
 * Used standalone via CLI, and imported as a module by build-contact-sheets.js.
 *
 * Usage:
 *   node scripts/diff-region.js <video-path> <beforeSeconds> <afterSeconds> [outputPath] [threshold] [padding]
 *
 * Exit code 2 (with no image written) if no region above the threshold
 * changed - i.e. the two timestamps are visually identical, which can happen
 * if a change-point is spurious/sub-pixel.
 */

const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const MIN_OUTPUT_WIDTH = 500;
const DEFAULT_THRESHOLD = 64;
const DEFAULT_PADDING = 24;

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 64 }, (err, stdout, stderr) => {
      // ffmpeg often "fails" (non-zero) on -f null pipelines even when the
      // filters ran fine, so resolve regardless and let the caller inspect
      // stderr for the actual filter output.
      resolve({ stdout, stderr, err });
    });
  });
}

async function extractFrame(videoPath, t, outPath) {
  await run("ffmpeg", [
    "-ss",
    String(t),
    "-i",
    videoPath,
    "-update",
    "1",
    "-vframes",
    "1",
    "-y",
    outPath,
  ]);
}

async function probeSize(imgPath) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=p=0",
    imgPath,
  ]);
  const [w, h] = stdout.trim().split(",").map(Number);
  return { w, h };
}

/**
 * Computes the changed region between two timestamps in a video and writes
 * a cropped, legible PNG of just that region (from the "after" frame) to
 * outputPath.
 *
 * Returns { ok: true, rect } on success, or { ok: false, reason } if no
 * region above the threshold changed.
 */
async function diffRegion(videoPath, before, after, outputPath, options = {}) {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const padding = options.padding ?? DEFAULT_PADDING;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "diff-region-"));
  const beforePath = path.join(tmpDir, "before.png");
  const afterPath = path.join(tmpDir, "after.png");

  try {
    await extractFrame(videoPath, before, beforePath);
    await extractFrame(videoPath, after, afterPath);

    const { stderr } = await run("ffmpeg", [
      "-i",
      afterPath,
      "-i",
      beforePath,
      "-filter_complex",
      `blend=all_mode=difference,bbox=min_val=${threshold}`,
      "-f",
      "null",
      "-",
    ]);

    const match = stderr.match(/crop=(\d+):(\d+):(\d+):(\d+)/);
    if (!match) {
      return { ok: false, reason: `no diff above threshold ${threshold}` };
    }

    const w = Number(match[1]);
    const h = Number(match[2]);
    const x = Number(match[3]);
    const y = Number(match[4]);

    const { w: frameW, h: frameH } = await probeSize(afterPath).catch(() => ({
      w: Infinity,
      h: Infinity,
    }));

    const padX = Math.max(0, x - padding);
    const padY = Math.max(0, y - padding);
    const padW = Math.min(frameW - padX, w + padding * 2);
    const padH = Math.min(frameH - padY, h + padding * 2);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const scaleArg = padW < MIN_OUTPUT_WIDTH ? `,scale=${MIN_OUTPUT_WIDTH}:-1` : "";

    await run("ffmpeg", [
      "-ss",
      String(after),
      "-i",
      videoPath,
      "-update",
      "1",
      "-vframes",
      "1",
      "-vf",
      `crop=${padW}:${padH}:${padX}:${padY}${scaleArg}`,
      "-y",
      outputPath,
    ]);

    return { ok: true, rect: { w: padW, h: padH, x: padX, y: padY } };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { diffRegion, DEFAULT_THRESHOLD, DEFAULT_PADDING };

if (require.main === module) {
  const [, , videoPath, beforeArg, afterArg, outputArg, thresholdArg, paddingArg] = process.argv;

  if (!videoPath || beforeArg === undefined || afterArg === undefined) {
    console.error(
      "Usage: node scripts/diff-region.js <video-path> <beforeSeconds> <afterSeconds> [outputPath] [threshold] [padding]"
    );
    process.exit(1);
  }

  const outputPath = outputArg || ".tmp/diff-regions/diff.png";

  diffRegion(videoPath, parseFloat(beforeArg), parseFloat(afterArg), outputPath, {
    threshold: thresholdArg ? parseInt(thresholdArg, 10) : undefined,
    padding: paddingArg ? parseInt(paddingArg, 10) : undefined,
  })
    .then((result) => {
      if (!result.ok) {
        console.error(result.reason);
        process.exit(2);
      }
      console.log(`Diff region: ${JSON.stringify(result.rect)}`);
      console.log(`Written to ${outputPath}`);
    })
    .catch((err) => {
      console.error("FAILED:", err.message);
      process.exit(1);
    });
}
