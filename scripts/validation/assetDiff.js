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

function getDiffAssetFolder(targetDir, relativeKey) {
  const parsed = path.posix.parse(relativeKey);
  const nestedDir = parsed.dir === "." ? "" : parsed.dir;
  return path.join(targetDir, nestedDir, parsed.name);
}

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

function buildFullFileMap(files, rootDir) {
  const map = {};
  files.forEach(file => {
    if (isProcessedArtifact(path.basename(file))) return;
    const key = buildRelativeKey(rootDir, file);
    map[key] = file;
  });
  return map;
}

function buildImageMap(files, rootDir) {
  const map = {};
  files.forEach(file => {
    const ext = path.extname(file).toLowerCase();
    if (isProcessedArtifact(path.basename(file))) return;
    if (imageExtensions.includes(ext)) {
      const key = buildRelativeKey(rootDir, file);
      map[key] = file;
    }
  });
  return map;
}

function copyAssetWithMeta(relativeKey, sourceMap, targetDir) {
  const sourceFile = sourceMap[relativeKey];
  const parsed = path.posix.parse(relativeKey);
  const base = parsed.name;

  const assetFolder = getDiffAssetFolder(targetDir, relativeKey);
  ensureDir(assetFolder);

  // Copy image
  fs.copyFileSync(sourceFile, path.join(assetFolder, path.basename(sourceFile)));

  // Check and copy .json / .atlas
  metaExtensions.forEach(metaExt => {
    const metaRelativeKey = (parsed.dir === "." ? "" : `${parsed.dir}/`) + `${base}${metaExt}`;
    if (sourceMap[metaRelativeKey]) {
      fs.copyFileSync(
        sourceMap[metaRelativeKey],
        path.join(assetFolder, path.basename(sourceMap[metaRelativeKey]))
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

  const newFullMap = buildFullFileMap(newFiles, newAssetsDir);
  const clonedFullMap = buildFullFileMap(clonedFiles, clonedDir);

  const newImageMap = buildImageMap(newFiles, newAssetsDir);
  const clonedImageMap = buildImageMap(clonedFiles, clonedDir);

  const newAssetNames = Object.keys(newImageMap);
  const clonedAssetNames = Object.keys(clonedImageMap);

  /* -------- NEW ASSETS -------- */
  newAssetNames.forEach(relativeKey => {
    if (!clonedImageMap[relativeKey]) {
      copyAssetWithMeta(relativeKey, newFullMap, newAssetsDiffDir);
      console.log("🆕 New Asset Detected:", relativeKey);
    }
  });

  /* -------- MISSING ASSETS -------- */
  clonedAssetNames.forEach(relativeKey => {
    if (!newImageMap[relativeKey]) {
      copyAssetWithMeta(relativeKey, clonedFullMap, missingAssetsDiffDir);
      console.log("❌ Missing Asset Detected:", relativeKey);
    }
  });

  console.log("\n🎯 Asset diff complete.");
}

runAssetDiff();