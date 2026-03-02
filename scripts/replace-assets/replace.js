const fs = require("fs");
const path = require("path");

const { ensureDir, getAllFiles } = require("./utils/fileUtils");
const { percentDiff, bytesToKB } = require("./utils/mathUtils");
const { getDimensions } = require("./utils/imageUtils");
const { isStrictAsset } = require("./utils/assetTypeUtils");
const { validateJsonStructure, flagJsonAsset } = require("./utils/jsonValidation");
const { validateAndHandleAtlas } = require("../validation/spriteAtlasValidation.js");

const projectRoot = path.resolve(__dirname, "../..");
const generatedRoot = path.join(projectRoot, "Generated");

const newAssetsDir = path.join(projectRoot, "NewAssets");
const clonedDir = path.join(generatedRoot, "Cloned-Game");
const flaggedRoot = path.join(generatedRoot, "flaggedAssets");

if (!fs.existsSync(generatedRoot)) {
  fs.mkdirSync(generatedRoot);
}

const initialFlaggedDir = path.join(flaggedRoot, "initialloadedflagged");
const normalFlaggedDir = path.join(flaggedRoot, "normalloadedflagged");
const jsonFlaggedDir = path.join(flaggedRoot, "jsonFlagged");

const supportedImageExt = [".png", ".jpg", ".jpeg", ".webp"];
const spriteExtensions = [".atlas", ".spline"];

/* ---------------- METRICS ---------------- */

let replacedCount = 0;
let strictSafeCount = 0;
let strictFlaggedCount = 0;
let normalSafeCount = 0;
let normalFlaggedCount = 0;
let jsonMismatchCount = 0;
let atlasMismatchCount = 0;
let totalInitialAssets = 0;

/* ---------------- UTIL ---------------- */


/* ---------------- MAIN PIPELINE ---------------- */

function calculateTotalImageSize(dir) {
  const allFiles = getAllFiles(dir);

  let totalBytes = 0;

  allFiles.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (supportedImageExt.includes(ext)) {
      totalBytes += fs.statSync(file).size;
    }
  });

  return totalBytes;
}

async function replaceAssets() {
  ensureDir(initialFlaggedDir);
  ensureDir(normalFlaggedDir);
  ensureDir(jsonFlaggedDir);

  const newFiles = getAllFiles(newAssetsDir);
  const clonedFiles = getAllFiles(clonedDir);

  const clonedMap = {};
  clonedFiles.forEach(file => {
    clonedMap[path.basename(file)] = file;
  });

  for (const newFile of newFiles) {
    const fileName = path.basename(newFile);
    const ext = path.extname(fileName).toLowerCase();

    if (!clonedMap[fileName]) continue;

    const oldFile = clonedMap[fileName];

    /* ---- SPRITE VALIDATION ---- */
    if (spriteExtensions.includes(ext)) {
      const atlasValid = validateAndHandleAtlas(fileName, oldFile, newFile);

      if (atlasValid) {
        fs.copyFileSync(newFile, oldFile);
        replacedCount++;
        console.log("🟢 Sprite replaced (validated):", fileName);
      } else {
        atlasMismatchCount++;
        console.log("🚨 Sprite atlas mismatch flagged:", fileName);
      }

      continue;
    }

    /* ---- JSON VALIDATION ---- */
    const baseName = path.parse(fileName).name;
    const newJsonPath = path.join(path.dirname(newFile), baseName + ".json");
    const oldJsonPath = path.join(path.dirname(oldFile), baseName + ".json");

    if (fs.existsSync(newJsonPath) && fs.existsSync(oldJsonPath)) {
      const jsonValid = validateJsonStructure(oldJsonPath, newJsonPath);

      if (!jsonValid) {
        jsonMismatchCount++;
        flagJsonAsset(jsonFlaggedDir, fileName, oldFile, newFile, oldJsonPath, newJsonPath, ensureDir);
        console.log("🚨 JSON STRUCTURE MISMATCH:", fileName);
        continue;
      }
    }

    /* ---- IMAGE SAFETY VALIDATION ---- */

    const oldStat = fs.statSync(oldFile);
    const newStat = fs.statSync(newFile);

    const sizeDifferencePercent = percentDiff(oldStat.size, newStat.size);
    const oldDimensions = await getDimensions(oldFile);
    const newDimensions = await getDimensions(newFile);

    const strict = isStrictAsset(fileName);

    let dimensionMatch = true;
    let dimensionDiffPercent = 0;

    if (oldDimensions && newDimensions) {
      const widthDiff = percentDiff(oldDimensions.width, newDimensions.width);
      const heightDiff = percentDiff(oldDimensions.height, newDimensions.height);
      dimensionDiffPercent = Math.max(widthDiff, heightDiff);
      dimensionMatch = widthDiff === 0 && heightDiff === 0;
    }

    let safeToReplace = false;

    if (strict) {
      totalInitialAssets++;
      if (dimensionMatch && sizeDifferencePercent <= 50) {
        safeToReplace = true;
      }
    } else {
      if (sizeDifferencePercent <= 70 && dimensionDiffPercent <= 20) {
        safeToReplace = true;
      }
    }

    if (safeToReplace) {
      fs.copyFileSync(newFile, oldFile);
      replacedCount++;

      if (strict) {
        strictSafeCount++;
      } else {
        normalSafeCount++;
      }

      console.log("✅ Replaced safely:", fileName);
    } else {

      const targetDir = strict ? initialFlaggedDir : normalFlaggedDir;
      const assetFolder = path.join(targetDir, baseName);
      ensureDir(assetFolder);
      fs.copyFileSync(oldFile, path.join(assetFolder, "original" + ext));
      fs.copyFileSync(newFile, path.join(assetFolder, "new" + ext));
      fs.writeFileSync(
        path.join(assetFolder, "details.json"),
        JSON.stringify({
          asset: fileName,
          strictCategory: strict,
          oldSizeKB: bytesToKB(oldStat.size),
          newSizeKB: bytesToKB(newStat.size),
          sizeDifferencePercent: sizeDifferencePercent.toFixed(2),
          oldDimensions,
          newDimensions,
          dimensionDifferencePercent: dimensionDiffPercent.toFixed(2)
        }, null, 2)
      );

      if (strict) {
        strictFlaggedCount++;
      } else {
        normalFlaggedCount++;
      }

      console.log("🚨 Flagged unsafe asset:", fileName);
    }
  }


  /* ---------------- WRITE METRICS ---------------- */

  const metricsPath = path.join(generatedRoot, "pipelineMetrics.json");

  // Helper to collect all flagged asset files (details.json) from a directory
  function collectFlaggedAssets(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .map(folder => {
        const detailsPath = path.join(dir, folder, "details.json");
        if (fs.existsSync(detailsPath)) {
          try {
            const details = JSON.parse(fs.readFileSync(detailsPath, "utf-8"));
            return { folder, ...details };
          } catch {
            return null;
          }
        }
        return null;
      })
      .filter(Boolean);
  }

  const flaggedAssets = {
    initialFlagged: collectFlaggedAssets(initialFlaggedDir),
    normalFlagged: collectFlaggedAssets(normalFlaggedDir),
    jsonFlagged: collectFlaggedAssets(jsonFlaggedDir)
  };

  /* ---- TOTAL SIZE CALCULATION ---- */

  const totalClonedBytes = calculateTotalImageSize(clonedDir);
  const totalNewBytes = calculateTotalImageSize(newAssetsDir);

  const totalClonedKB = (totalClonedBytes / 1024).toFixed(2);
  const totalNewKB = (totalNewBytes / 1024).toFixed(2);

  const totalDiffBytes = totalNewBytes - totalClonedBytes;
  const totalDiffKB = (totalDiffBytes / 1024).toFixed(2);
  const totalDiffMB = (totalDiffBytes / (1024 * 1024)).toFixed(2);

  /* ---- MISSING & NEW ASSETS ---- */
  const assetDiffRoot = path.join(generatedRoot, "assetdiff");
  const missingAssetsDir = path.join(assetDiffRoot, "missingAssets");
  const newAssetsDiffDir = path.join(assetDiffRoot, "newAssets");

  function listAssetFolders(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => {
      const full = path.join(dir, f);
      return fs.statSync(full).isDirectory();
    });
  }

  const missingAssets = listAssetFolders(missingAssetsDir);
  const newAssets = listAssetFolders(newAssetsDiffDir);

  /* ---- SUMMARY ---- */

  const summary = {
    replacedCount,
    strictSafeCount,
    strictFlaggedCount,
    normalSafeCount,
    normalFlaggedCount,
    jsonMismatchCount,
    atlasMismatchCount,
    totalInitialAssets,

    oldGameAssetSize: totalClonedKB,
    newGameAssetSize: totalNewKB,
    totalAssetSizeDiffKB: totalDiffKB,
    totalAssetSizeDiffMB: totalDiffMB,

    flaggedAssets,
    missingAssets,
    newAssets
  };

  fs.writeFileSync(metricsPath, JSON.stringify(summary, null, 2));

  console.log("\n🎯 FULL VALIDATION + REPLACEMENT COMPLETE.");
}

replaceAssets();