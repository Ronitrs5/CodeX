const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const projectRoot = path.resolve(__dirname, "../..");
const newAssetsDir = path.join(projectRoot, "NewAssets");
const clonedDir = path.join(projectRoot, "Cloned-Game");
const reportPath = path.join(projectRoot, "report.json");

const supportedImageExt = [".png", ".jpg", ".jpeg", ".webp"];

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

function bytesToKB(bytes) {
  return (bytes / 1024).toFixed(2);
}

async function getDimensions(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (!supportedImageExt.includes(ext)) return null;

    const metadata = await sharp(filePath).metadata();

    if (!metadata.width || !metadata.height) return null;

    return `${metadata.width}x${metadata.height}`;
  } catch {
    return null;
  }
}

async function replaceAssets() {
  if (!fs.existsSync(newAssetsDir)) {
    console.error("❌ NewAssets folder not found.");
    process.exit(1);
  }

  if (!fs.existsSync(clonedDir)) {
    console.error("❌ Cloned-Game folder not found.");
    process.exit(1);
  }

  const newFiles = getAllFiles(newAssetsDir);
  const clonedFiles = getAllFiles(clonedDir);

  const clonedMap = {};

  clonedFiles.forEach((file) => {
    clonedMap[path.basename(file)] = file;
  });

  const report = {
    sizeChangedOnly: [],
    dimensionChangedOnly: [],
    bothChanged: [],
    unchanged: []
  };

  for (const newFile of newFiles) {
    const fileName = path.basename(newFile);

    if (!clonedMap[fileName]) continue;

    const oldFile = clonedMap[fileName];

    const oldStat = fs.statSync(oldFile);
    const newStat = fs.statSync(newFile);

    const oldSizeKB = bytesToKB(oldStat.size);
    const newSizeKB = bytesToKB(newStat.size);
    const sizeDifferenceKB = bytesToKB(newStat.size - oldStat.size);

    const oldDimensions = await getDimensions(oldFile);
    const newDimensions = await getDimensions(newFile);

    // Replace file
    fs.copyFileSync(newFile, oldFile);

    const sizeChanged = oldSizeKB !== newSizeKB;
    const dimensionChanged = oldDimensions !== newDimensions;

    const entry = {
      file: fileName,
      oldSizeKB,
      newSizeKB,
      sizeDifferenceKB,
      oldDimensions,
      newDimensions
    };

    if (sizeChanged && dimensionChanged) {
      report.bothChanged.push(entry);
    } else if (sizeChanged) {
      report.sizeChangedOnly.push(entry);
    } else if (dimensionChanged) {
      report.dimensionChangedOnly.push(entry);
    } else {
      report.unchanged.push(entry);
    }

    console.log(`🔁 Replaced: ${fileName}`);
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("\n📊 report.json generated successfully.");
}

replaceAssets();