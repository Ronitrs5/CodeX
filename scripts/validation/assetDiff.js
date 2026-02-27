const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "../..");
const generatedRoot = path.join(projectRoot, "Generated");

const newAssetsDir = path.join(projectRoot, "NewAssets");
const clonedDir = path.join(generatedRoot, "Cloned-Game");

const diffRoot = path.join(generatedRoot, "assetdiff");
const newAssetsDiffDir = path.join(diffRoot, "newAssets");
const missingAssetsDiffDir = path.join(diffRoot, "missingAssets");

const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
const metaExtensions = [".json", ".atlas"];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath));
    } else {
      results.push(filePath);
    }
  });

  return results;
}

function buildFullFileMap(files) {
  const map = {};
  files.forEach(file => {
    map[path.basename(file)] = file;
  });
  return map;
}

function buildImageMap(files) {
  const map = {};
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (imageExtensions.includes(ext)) {
      map[path.basename(file)] = file;
    }
  });
  return map;
}

function copyAssetWithMeta(baseName, sourceMap, targetDir) {
  const base = path.parse(baseName).name;
  const ext = path.parse(baseName).ext;

  const assetFolder = path.join(targetDir, base);
  ensureDir(assetFolder);

  // Copy image
  fs.copyFileSync(sourceMap[baseName], path.join(assetFolder, baseName));

  // Check and copy .json / .atlas
  metaExtensions.forEach(metaExt => {
    const metaFileName = base + metaExt;
    if (sourceMap[metaFileName]) {
      fs.copyFileSync(
        sourceMap[metaFileName],
        path.join(assetFolder, metaFileName)
      );
    }
  });
}

function runAssetDiff() {
  ensureDir(diffRoot);
  ensureDir(newAssetsDiffDir);
  ensureDir(missingAssetsDiffDir);

  const newFiles = getAllFiles(newAssetsDir);
  const clonedFiles = getAllFiles(clonedDir);

  const newFullMap = buildFullFileMap(newFiles);
  const clonedFullMap = buildFullFileMap(clonedFiles);

  const newImageMap = buildImageMap(newFiles);
  const clonedImageMap = buildImageMap(clonedFiles);

  const newAssetNames = Object.keys(newImageMap);
  const clonedAssetNames = Object.keys(clonedImageMap);

  /* -------- NEW ASSETS -------- */
  newAssetNames.forEach(fileName => {
    if (!clonedImageMap[fileName]) {
      copyAssetWithMeta(fileName, newFullMap, newAssetsDiffDir);
      console.log("🆕 New Asset Detected:", fileName);
    }
  });

  /* -------- MISSING ASSETS -------- */
  clonedAssetNames.forEach(fileName => {
    if (!newImageMap[fileName]) {
      copyAssetWithMeta(fileName, clonedFullMap, missingAssetsDiffDir);
      console.log("❌ Missing Asset Detected:", fileName);
    }
  });

  console.log("\n🎯 Asset diff complete.");
}

runAssetDiff();