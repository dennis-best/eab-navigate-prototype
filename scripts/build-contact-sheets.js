#!/usr/bin/env node
/**
 * build-contact-sheets.js
 *
 * Takes a change-points JSON file (from extract-changepoints.js) and builds
 * grid "contact sheet" images: many small labeled thumbnails packed into one
 * image file. This lets a single image read cover dozens of moments in the
 * video, instead of reading one full-resolution frame per moment.
 *
 * Workflow:
 *   1. node scripts/extract-changepoints.js videos/original.mp4
 *   2. node scripts/build-contact-sheets.js videos/original.mp4 .tmp/changepoints/original.json
 *   3. Read the generated sheets in .tmp/contact-sheets/ to triage.
 *   4. For any tile that looks like it needs precise reading (an open
 *      dropdown, a chart, a populated table), extract just that one
 *      timestamp at full resolution:
 *        ffmpeg -ss <t> -i videos/original.mp4 -vframes 1 -vf scale=1000:-1 out.jpg
 *
 * Usage:
 *   node scripts/build-contact-sheets.js <video-path> <changepoints-json> [outDir] [perSheet] [cols] [thumbWidth]
 */

const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

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

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 64 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, "0");
  // avoid ":" - it's a drawtext filter-option separator and breaks parsing
  return `${m}m${s}s`;
}

async function extractLabeledThumb(t, index) {
  const outPath = path.join(framesDir, `f_${String(index).padStart(4, "0")}.jpg`);
  // NOTE: this ffmpeg build has no drawtext/libfreetype support, so
  // timestamps are not burned into the thumbnail pixels. Instead, rely on
  // manifest.json (written alongside each sheet) which maps every grid
  // position, in row-major order, to its exact source timestamp.
  const vf = `scale=${thumbWidth}:-1`;
  await run("ffmpeg", [
    "-ss",
    String(t),
    "-i",
    videoPath,
    "-vframes",
    "1",
    "-vf",
    vf,
    "-y",
    outPath,
  ]);
  return outPath;
}

async function buildSheet(framePaths, sheetIndex) {
  const sheetPath = path.join(outDir, `sheet-${String(sheetIndex).padStart(2, "0")}.jpg`);
  const rows = Math.ceil(framePaths.length / cols);
  // Pad with the last frame repeated if the final sheet isn't a full grid,
  // since ffmpeg's tile filter requires an exact cols*rows frame count.
  const needed = cols * rows;
  const inputs = [...framePaths];
  while (inputs.length < needed) inputs.push(framePaths[framePaths.length - 1]);

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
  console.log(`${timestamps.length} change-points -> ${Math.ceil(timestamps.length / perSheet)} contact sheet(s)`);

  const allFramePaths = [];
  for (let i = 0; i < timestamps.length; i++) {
    const p = await extractLabeledThumb(timestamps[i], i);
    allFramePaths.push(p);
    if (i % 50 === 0) console.log(`Extracted thumbnail ${i + 1}/${timestamps.length}`);
  }

  const manifest = [];
  let sheetIndex = 0;
  for (let i = 0; i < allFramePaths.length; i += perSheet) {
    const chunk = allFramePaths.slice(i, i + perSheet);
    const chunkTimestamps = timestamps.slice(i, i + perSheet);
    sheetIndex++;
    const sheetPath = await buildSheet(chunk, sheetIndex);
    manifest.push({
      sheet: sheetPath,
      cols,
      startIndex: i,
      endIndex: i + chunk.length - 1,
      // Row-major order: tile at (row, col) = timestamps[row*cols + col]
      timestamps: chunkTimestamps,
    });
    console.log(`Built ${sheetPath} (${chunk.length} tiles, t=${chunkTimestamps[0].toFixed(1)}-${chunkTimestamps[chunkTimestamps.length - 1].toFixed(1)}s)`);
  }

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${manifest.length} contact sheet(s) written to ${outDir}/`);
  console.log(`Manifest: ${path.join(outDir, "manifest.json")}`);
})().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
