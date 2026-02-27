const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "../..");
const generatedRoot = path.join(projectRoot, "Generated");

const clonedDir = path.join(generatedRoot, "Cloned-Game");
const outputDir = path.join(generatedRoot, "extractedImages");

if (!fs.existsSync(generatedRoot)) {
  fs.mkdirSync(generatedRoot);
}

const supportedImageExt = [
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".webp",
  ".gif",
  ".bmp"
];

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

function extractImagesFlat() {
  if (!fs.existsSync(clonedDir)) {
    console.error("❌ Cloned-Game folder not found.");
    process.exit(1);
  }

  if (fs.existsSync(outputDir)) {
    console.log("⚠️ extractedImages already exists. Deleting...");
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  fs.mkdirSync(outputDir);

  const allFiles = getAllFiles(clonedDir);

  let extractedCount = 0;
  const nameCounter = {};

  allFiles.forEach((file) => {
    const ext = path.extname(file).toLowerCase();

    if (supportedImageExt.includes(ext)) {
      let baseName = path.basename(file);

      // Handle duplicate filenames
      if (nameCounter[baseName]) {
        const nameWithoutExt = path.parse(baseName).name;
        const extension = path.parse(baseName).ext;
        baseName = `${nameWithoutExt}_${nameCounter[baseName]}${extension}`;
        nameCounter[path.basename(file)]++;
      } else {
        nameCounter[baseName] = 1;
      }

      const destinationPath = path.join(outputDir, baseName);
      fs.copyFileSync(file, destinationPath);

      extractedCount++;
      console.log(`📦 Extracted: ${baseName}`);
    }
  });

  console.log(`\n✅ Extraction complete. Total images extracted: ${extractedCount}`);
}

extractImagesFlat();