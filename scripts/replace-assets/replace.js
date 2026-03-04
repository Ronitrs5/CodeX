const fs = require("fs");
const path = require("path");

const { ensureDir, getAllFiles } = require("./utils/fileUtils");
const { percentDiff, bytesToKB } = require("./utils/mathUtils");
const { getDimensions } = require("./utils/imageUtils");
const { isStrictAsset } = require("./utils/assetTypeUtils");
const { validateJsonStructure, flagJsonAsset } = require("./utils/jsonValidation");
const { validateAndHandleAtlas } = require("../validation/spriteAtlasValidation.js");
const { semanticCompare } = require("../shared/semanticUtils");

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
const semanticFlaggedDir = path.join(flaggedRoot, "semanticFlagged");

const supportedImageExt = [".png", ".jpg", ".jpeg", ".webp"];
const spriteExtensions = [".atlas", ".spline"];

function normalizeProcessedSuffix(fileName) {
  return fileName.toLowerCase().replace(/(\.[a-z0-9]+)_processed(\.[a-z0-9]+)$/i, "$1");
}

function isProcessedArtifact(fileName) {
  return /(\.[a-z0-9]+)_processed(\.[a-z0-9]+)$/i.test(fileName);
}

function toPosixPath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function buildRelativeKey(rootDir, filePath) {
  const relativePath = toPosixPath(path.relative(rootDir, filePath));
  const dir = path.posix.dirname(relativePath).toLowerCase();
  const baseName = normalizeProcessedSuffix(path.posix.basename(relativePath));
  return dir === "." ? baseName : `${dir}/${baseName}`;
}

function getFlagAssetFolder(targetDir, relativePath) {
  const posixRelativePath = toPosixPath(relativePath);
  const parsed = path.posix.parse(posixRelativePath);
  const nestedDir = parsed.dir === "." ? "" : parsed.dir;
  return path.join(targetDir, nestedDir, parsed.name);
}

/* ---------------- METRICS ---------------- */

let replacedCount = 0;
let strictSafeCount = 0;
let strictFlaggedCount = 0;
let normalSafeCount = 0;
let normalFlaggedCount = 0;
let jsonMismatchCount = 0;
let atlasMismatchCount = 0;
let totalInitialAssets = 0;
let semanticCriticalCount = 0;
let semanticWarningCount = 0;
let semanticOcrUnavailableCount = 0;
let semanticOcrWarningLogged = false;

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
  ensureDir(semanticFlaggedDir);

  const newFiles = getAllFiles(newAssetsDir);
  const clonedFiles = getAllFiles(clonedDir);

  const clonedMap = {};
  clonedFiles.forEach(file => {
    if (isProcessedArtifact(path.basename(file))) return;
    const key = buildRelativeKey(clonedDir, file);
    clonedMap[key] = file;
  });

  for (const newFile of newFiles) {
    const relativeNewPath = toPosixPath(path.relative(newAssetsDir, newFile));
    const relativeKey = buildRelativeKey(newAssetsDir, newFile);
    const fileName = path.basename(newFile);
    const ext = path.extname(fileName).toLowerCase();

    const oldFile = clonedMap[relativeKey];
    if (!oldFile) continue;

    /* ---- SPRITE VALIDATION ---- */
    if (spriteExtensions.includes(ext)) {
      const atlasValid = validateAndHandleAtlas(fileName, oldFile, newFile, relativeNewPath);

      if (atlasValid) {
        fs.copyFileSync(newFile, oldFile);
        replacedCount++;
        console.log("🟢 Sprite replaced (validated):", relativeNewPath);
      } else {
        atlasMismatchCount++;
        console.log("🚨 Sprite atlas mismatch flagged:", relativeNewPath);
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
        flagJsonAsset(jsonFlaggedDir, relativeNewPath, oldFile, newFile, oldJsonPath, newJsonPath, ensureDir);
        console.log("🚨 JSON STRUCTURE MISMATCH:", relativeNewPath);
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

    if (safeToReplace && supportedImageExt.includes(ext)) {

  // ---- SEMANTIC VALIDATION ----
  const semanticResult = await semanticCompare(oldFile, newFile);

  if (semanticResult.status === "OCR_UNAVAILABLE") {
    semanticOcrUnavailableCount++;
    if (!semanticOcrWarningLogged) {
      console.log("⚠️ Semantic OCR unavailable. Set TESSERACT_LANG_PATH or TESSERACT_ONLINE_MODE=1 to enable semantic checks.");
      semanticOcrWarningLogged = true;
    }
  }

  if (semanticResult.severity === "CRITICAL") {
    semanticCriticalCount++;

    const assetFolder = getFlagAssetFolder(semanticFlaggedDir, relativeNewPath);
    ensureDir(assetFolder);

    fs.copyFileSync(oldFile, path.join(assetFolder, "original" + ext));
    fs.copyFileSync(newFile, path.join(assetFolder, "new" + ext));

    fs.writeFileSync(
      path.join(assetFolder, "semantic-details.json"),
      JSON.stringify({
        asset: relativeNewPath,
        parentText: semanticResult.parentText,
        newText: semanticResult.newText,
        status: semanticResult.status
      }, null, 2)
    );

    console.log("🚨 CRITICAL SEMANTIC MISMATCH:", relativeNewPath);
    continue; // DO NOT replace
  }

  if (semanticResult.severity === "WARNING") {
    semanticWarningCount++;
    console.log("⚠️ Semantic text mismatch:", relativeNewPath);
  }

  fs.copyFileSync(newFile, oldFile);
  replacedCount++;

  if (strict) {
    strictSafeCount++;
  } else {
    normalSafeCount++;
  }

  console.log("✅ Replaced safely:", relativeNewPath);
}else {

      const targetDir = strict ? initialFlaggedDir : normalFlaggedDir;
      const assetFolder = getFlagAssetFolder(targetDir, relativeNewPath);
      ensureDir(assetFolder);
      fs.copyFileSync(oldFile, path.join(assetFolder, "original" + ext));
      fs.copyFileSync(newFile, path.join(assetFolder, "new" + ext));
      fs.writeFileSync(
        path.join(assetFolder, "details.json"),
        JSON.stringify({
          asset: relativeNewPath,
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

      console.log("🚨 Flagged unsafe asset:", relativeNewPath);
    }
  }


  /* ---------------- WRITE METRICS ---------------- */

  const metricsPath = path.join(generatedRoot, "pipelineMetrics.json");

  function listDirectoriesRecursively(dir) {
    if (!fs.existsSync(dir)) return [];

    const output = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (!entry.isDirectory()) return;

      output.push(fullPath);
      output.push(...listDirectoriesRecursively(fullPath));
    });

    return output;
  }

  // Helper to collect all flagged asset files (details.json) from a directory
  function collectFlaggedAssets(dir) {
    if (!fs.existsSync(dir)) return [];

    return listDirectoriesRecursively(dir)
      .map(assetDir => {
        const detailsPath = path.join(assetDir, "details.json");
        if (fs.existsSync(detailsPath)) {
          try {
            const details = JSON.parse(fs.readFileSync(detailsPath, "utf-8"));
            const folder = toPosixPath(path.relative(dir, assetDir));
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
/* ---- MISSING & NEW ASSETS ---- */

const assetDiffRoot = path.join(flaggedRoot, "assetdiff");
ensureDir(assetDiffRoot);
const missingAssetsDir = path.join(assetDiffRoot, "missingAssets");
const newAssetsDiffDir = path.join(assetDiffRoot, "newAssets");
ensureDir(missingAssetsDir);
ensureDir(newAssetsDiffDir);

  function listAssetFolders(dir) {
    if (!fs.existsSync(dir)) return [];

    return listDirectoriesRecursively(dir)
      .filter(folder => fs.existsSync(path.join(folder, "details.json")) || fs.readdirSync(folder).some(item => fs.statSync(path.join(folder, item)).isFile()))
      .map(folder => toPosixPath(path.relative(dir, folder)));
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
    newAssets,
    semanticCriticalCount,
semanticWarningCount,
    semanticOcrUnavailableCount,
  };

  fs.writeFileSync(metricsPath, JSON.stringify(summary, null, 2));

  console.log("\n🎯 FULL VALIDATION + REPLACEMENT COMPLETE.");
}

replaceAssets();