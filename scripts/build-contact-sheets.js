#!/usr/bin/env node
/**
 * build-contact-sheets.js
 *
 * Takes a change-points JSON file (from extract-changepoints.js) and builds
 * grid "contact sheet" images: many small labeled tiles packed into one
 * image file. This lets a single image read cover dozens of moments in the
 * video, instead of reading one full-resolution frame per moment.
 *
 * Each tile is a PAIR, stacked vertically:
 *   - top: the normal full-frame thumbnail at that timestamp
 *   - bottom: an auto-cropped, upscaled "what changed" region (via
 *     diff-region.js / ffmpeg blend=difference+bbox, zero AI-token cost),
 *     computed against the previous change-point.
 *
 * This exists specifically because a full-frame thumbnail alone is easy to
 * misread: a small change in one corner (e.g. a dropdown menu appearing near
 * a page title) can be missed when other, larger motion is happening
 * elsewhere in the same frame. The diff-crop half of each tile points
 * directly at what changed, so nothing needs to be spotted by eye alone.
 *
 * Workflow:
 *   1. node scripts/extract-changepoints.js videos/original.mp4
 *   2. node scripts/build-contact-sheets.js videos/original.mp4 .tmp/changepoints/original.json
 *   3. Read the generated sheets in .tmp/contact-sheets/ to triage. For each
 *      tile, check BOTH halves: the full frame (context) and the diff-crop
 *      (exactly what changed) - don't rely on the full frame alone.
 *   4. For any tile that still needs precise reading (e.g. exact text in a
 *      populated dropdown/table), extract just that one timestamp at full
 *      resolution:
 *        ffmpeg -ss <t> -i videos/original.mp4 -vframes 1 -vf scale=1000:-1 out.jpg
 *
 * Usage:
 *   node scripts/build-contact-sheets.js <video-path> <changepoints-json> [outDir] [perSheet] [cols] [thumbWidth]
 */

const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const { diffRegion } = require("./diff-region");

const videoPath = process.argv[2];
const changepointsPath = process.argv[3];
const outDir = process.argv[4] || ".tmp/contact-sheets";
const perSheet = parseInt(process.argv[5] || "30", 10);
const cols = parseInt(process.argv[6] || "6", 10);
const thumbWidth = parseInt(process.argv[7] || "320", 10);

if (!videoPath || !fs.existsSync(videoPath)) {
  console.error("Video not found:", videoPath);
  process.exit(1);
}
if (!changepointsPath || !fs.existsSync(changepointsPath)) {
  console.error("Changepoints JSON not found:", changepointsPath);
  process.exit(1);
}

const changepoints = JSON.parse(fs.readFileSync(changepointsPath, "utf8"));
const timestamps = changepoints.map((c) => c.t);

fs.mkdirSync(outDir, { recursive: true });
const framesDir = path.join(outDir, "_frames");
fs.mkdirSync(framesDir, { recursive: true });

// Fixed per-tile layout: top half is the full-frame thumbnail, bottom half
// is the diff-crop, letterboxed/padded to a consistent size so ffmpeg's tile
// filter (which requires uniform frame dimensions) can mosaic them.
// yuv420p (used by the jpeg intermediates) requires even width/height, or
// ffmpeg's scale filter silently rounds up and breaks a same-size pad step
// downstream. Round to the nearest even number to avoid that off-by-one.
const THUMB_HEIGHT = Math.round(thumbWidth / 1.4377 / 2) * 2; // matches source video aspect ratio
const DIFF_HEIGHT = THUMB_HEIGHT;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 64 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

async function extractThumb(t, outPath) {
  await run("ffmpeg", [
    "-ss",
    String(t),
    "-i",
    videoPath,
    "-vframes",
    "1",
    "-vf",
    `scale=${thumbWidth}:${THUMB_HEIGHT}`,
    "-y",
    outPath,
  ]);
  return outPath;
}

async function buildDiffCrop(prevT, t, outPath) {
  const result = await diffRegion(videoPath, prevT, t, outPath).catch(() => ({ ok: false }));
  if (result.ok) return true;
  // No detectable change (or diff-region failed) - use a blank filler frame
  // rather than skip the tile, so every composite tile is the same size.
  await run("ffmpeg", [
    "-f",
    "lavfi",
    "-i",
    `color=c=0xf0f0f0:s=${thumbWidth}x${DIFF_HEIGHT}`,
    "-vframes",
    "1",
    "-y",
    outPath,
  ]);
  return false;
}

async function composeTile(thumbPath, diffPath, outPath) {
  // Letterbox the diff-crop (arbitrary aspect ratio) into a fixed box, then
  // stack it below the thumbnail (fixed size already).
  await run("ffmpeg", [
    "-i",
    thumbPath,
    "-i",
    diffPath,
    "-filter_complex",
    `[1:v]scale=${thumbWidth}:${DIFF_HEIGHT}:force_original_aspect_ratio=decrease,pad=${thumbWidth}:${DIFF_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0xf0f0f0[d];[0:v][d]vstack`,
    "-frames:v",
    "1",
    "-y",
    outPath,
  ]);
  return outPath;
}

async function buildSheet(tilePaths, sheetIndex) {
  const sheetPath = path.join(outDir, `sheet-${String(sheetIndex).padStart(2, "0")}.jpg`);
  const rows = Math.ceil(tilePaths.length / cols);
  const needed = cols * rows;
  const inputs = [...tilePaths];
  while (inputs.length < needed) inputs.push(tilePaths[tilePaths.length - 1]);

  // ffmpeg's tile filter tiles sequential frames from a single input stream,
  // not separate -i streams. Stage the frames as a numbered sequence so they
  // can be fed in as one image2 input.
  const stageDir = path.join(outDir, `_stage_${sheetIndex}`);
  fs.mkdirSync(stageDir, { recursive: true });
  inputs.forEach((p, i) => {
    const dest = path.join(stageDir, `${String(i).padStart(4, "0")}.jpg`);
    fs.copyFileSync(p, dest);
  });

  await run("ffmpeg", [
    "-start_number",
    "0",
    "-i",
    path.join(stageDir, "%04d.jpg"),
    "-vf",
    `tile=${cols}x${rows}`,
    "-frames:v",
    "1",
    "-y",
    sheetPath,
  ]);

  fs.rmSync(stageDir, { recursive: true, force: true });
  return sheetPath;
}

(async () => {
  console.log(
    `${timestamps.length} change-points -> ${Math.ceil(timestamps.length / perSheet)} contact sheet(s), each tile = thumbnail + diff-crop`
  );

  const allTilePaths = [];
  let diffHits = 0;
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const prevT = i === 0 ? t : timestamps[i - 1];

    const thumbPath = path.join(framesDir, `thumb_${String(i).padStart(4, "0")}.jpg`);
    const diffPath = path.join(framesDir, `diff_${String(i).padStart(4, "0")}.jpg`);
    const tilePath = path.join(framesDir, `tile_${String(i).padStart(4, "0")}.jpg`);

    await extractThumb(t, thumbPath);
    const hadDiff = i === 0 ? false : await buildDiffCrop(prevT, t, diffPath);
    if (i === 0) {
      // First change-point has no "before" - fill with blank rather than
      // diffing the frame against itself.
      await run("ffmpeg", [
        "-f",
        "lavfi",
        "-i",
        `color=c=0xf0f0f0:s=${thumbWidth}x${DIFF_HEIGHT}`,
        "-vframes",
        "1",
        "-y",
        diffPath,
      ]);
    } else if (hadDiff) {
      diffHits++;
    }
    await composeTile(thumbPath, diffPath, tilePath);
    allTilePaths.push(tilePath);

    // Frames are consumed into the composite tile immediately; delete to
    // avoid doubling disk usage across a full-video run.
    fs.rmSync(thumbPath, { force: true });
    fs.rmSync(diffPath, { force: true });

    if (i % 25 === 0) console.log(`Built tile ${i + 1}/${timestamps.length}`);
  }

  const manifest = [];
  let sheetIndex = 0;
  for (let i = 0; i < allTilePaths.length; i += perSheet) {
    const chunk = allTilePaths.slice(i, i + perSheet);
    const chunkTimestamps = timestamps.slice(i, i + perSheet);
    sheetIndex++;
    const sheetPath = await buildSheet(chunk, sheetIndex);
    manifest.push({
      sheet: sheetPath,
      cols,
      startIndex: i,
      endIndex: i + chunk.length - 1,
      // Row-major order: tile at (row, col) = timestamps[row*cols + col].
      // Each tile is [full-frame thumbnail on top, diff-crop on bottom].
      timestamps: chunkTimestamps,
    });
    console.log(
      `Built ${sheetPath} (${chunk.length} tiles, t=${chunkTimestamps[0].toFixed(1)}-${chunkTimestamps[chunkTimestamps.length - 1].toFixed(1)}s)`
    );
  }

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(
    `\nDone. ${manifest.length} contact sheet(s) written to ${outDir}/ (${diffHits}/${timestamps.length} tiles had a detectable diff-crop)`
  );
  console.log(`Manifest: ${path.join(outDir, "manifest.json")}`);
})().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
