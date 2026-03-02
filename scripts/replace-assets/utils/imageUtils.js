const sharp = require("sharp");

async function getDimensions(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    if (!metadata.width || !metadata.height) return null;
    return { width: metadata.width, height: metadata.height };
  } catch {
    return null;
  }
}

module.exports = { getDimensions };
