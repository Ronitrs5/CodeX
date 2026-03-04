const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "../..");
const generatedRoot = path.join(projectRoot, "Generated");

const clonedDir = path.join(generatedRoot, "Cloned-Game");
const outputDir = path.join(projectRoot, "NewAssets");

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

function extractImagesFolderWise() {
  if (!fs.existsSync(clonedDir)) {
    console.error("❌ Cloned-Game folder not found.");
    process.exit(1);
  }

  if (fs.existsSync(outputDir)) {
    console.log("⚠️ NewAssets already exists. Deleting for fresh folder-wise extraction...");
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const allFiles = getAllFiles(clonedDir);

  let extractedCount = 0;

  allFiles.forEach((file) => {
    const ext = path.extname(file).toLowerCase();

    if (supportedImageExt.includes(ext)) {
      const relativePath = path.relative(clonedDir, file);
      const destinationPath = path.join(outputDir, relativePath);
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.copyFileSync(file, destinationPath);

      extractedCount++;
      console.log(`📦 Extracted: ${relativePath}`);
    }
  });

  console.log(`\n✅ Folder-wise extraction complete into NewAssets. Total images extracted: ${extractedCount}`);
}

extractImagesFolderWise();