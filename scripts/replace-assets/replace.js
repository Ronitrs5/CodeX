const fs = require("fs");
const path = require("path");
const sizeOf = require("image-size");

const parentDir = path.resolve(__dirname, "../../..");
const newAssetsDir = path.join(parentDir, "NewAssets");
const clonedDir = path.join(parentDir, "Cloned-Game");
const reportPath = path.join(parentDir, "report.json");

const supportedImageExt = [".png", ".jpg", ".jpeg"];
const supportedExt = [
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".json",
  ".atlas",
  ".webp"
];

let report = [];

function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath));
    } else {
      results.push(filePath);
    }
  });

  return results;
}

function getDimensions(filePath) {
  try {
    if (supportedImageExt.includes(path.extname(filePath).toLowerCase())) {
      return sizeOf(filePath);
    }
  } catch {
    return null;
  }
  return null;
}

function bytesToKB(bytes) {
  return (bytes / 1024).toFixed(2);
}

function replaceAssets() {
  const newFiles = getAllFiles(newAssetsDir);
  const clonedFiles = getAllFiles(clonedDir);

  const clonedMap = {};

  clonedFiles.forEach((file) => {
    clonedMap[path.basename(file)] = file;
  });

  newFiles.forEach((newFile) => {
    const fileName = path.basename(newFile);
    const ext = path.extname(newFile).toLowerCase();

    if (!supportedExt.includes(ext)) return;

    if (clonedMap[fileName]) {
      const oldFile = clonedMap[fileName];

      const oldStat = fs.statSync(oldFile);
      const newStat = fs.statSync(newFile);

      const oldSizeKB = bytesToKB(oldStat.size);
      const newSizeKB = bytesToKB(newStat.size);

      const sizeDiffKB = bytesToKB(newStat.size - oldStat.size);

      const oldDim = getDimensions(oldFile);
      const newDim = getDimensions(newFile);

      fs.copyFileSync(newFile, oldFile);

      report.push({
        file: fileName,
        oldSizeKB,
        newSizeKB,
        sizeDifferenceKB: sizeDiffKB,
        oldDimensions: oldDim
          ? `${oldDim.width}x${oldDim.height}`
          : null,
        newDimensions: newDim
          ? `${newDim.width}x${newDim.height}`
          : null,
      });

      console.log(`🔁 Replaced: ${fileName}`);
    }
  });

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("📊 report.json generated.");
}

replaceAssets();