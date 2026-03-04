const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "../..");
const generatedRoot = path.join(projectRoot, "Generated");

const flaggedRoot = path.join(generatedRoot, "flaggedAssets");
const spriteFlaggedDir = path.join(flaggedRoot, "spriteAtlasFlagged");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function toPosixPath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function getFlagAssetFolder(fileOrPath) {
  const parsed = path.posix.parse(toPosixPath(fileOrPath));
  const nestedDir = parsed.dir === "." ? "" : parsed.dir;
  return path.join(spriteFlaggedDir, nestedDir, parsed.name);
}

function extractFrameNames(atlasContent) {
  const lines = atlasContent.split("\n");
  const frames = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (
      trimmed.includes(":") ||
      trimmed.startsWith("size") ||
      trimmed.startsWith("format") ||
      trimmed.startsWith("filter") ||
      trimmed.startsWith("repeat")
    ) continue;

    if (!line.startsWith(" ") && !trimmed.includes(":")) {
      frames.push(trimmed);
    }
  }

  return frames.sort();
}

function validateAtlasStructure(oldPath, newPath) {
  const oldContent = fs.readFileSync(oldPath, "utf-8");
  const newContent = fs.readFileSync(newPath, "utf-8");

  const oldFrames = extractFrameNames(oldContent);
  const newFrames = extractFrameNames(newContent);

  const missingFrames = oldFrames.filter(f => !newFrames.includes(f));
  const extraFrames = newFrames.filter(f => !oldFrames.includes(f));

  return {
    oldFrameCount: oldFrames.length,
    newFrameCount: newFrames.length,
    missingFrames,
    extraFrames,
    isValid:
      missingFrames.length === 0 &&
      extraFrames.length === 0 &&
      oldFrames.length === newFrames.length
  };
}

function flagAtlas(fileName, oldPath, newPath, details, assetPath) {
  ensureDir(spriteFlaggedDir);

  const assetFolder = getFlagAssetFolder(assetPath || fileName);

  ensureDir(assetFolder);

  fs.copyFileSync(oldPath, path.join(assetFolder, "original.atlas"));
  fs.copyFileSync(newPath, path.join(assetFolder, "new.atlas"));

  fs.writeFileSync(
    path.join(assetFolder, "details.json"),
    JSON.stringify(details, null, 2)
  );
}

function validateAndHandleAtlas(fileName, oldPath, newPath, assetPath) {
  const result = validateAtlasStructure(oldPath, newPath);

  if (!result.isValid) {
    flagAtlas(fileName, oldPath, newPath, result, assetPath);
    return false;
  }

  return true;
}

module.exports = {
  validateAndHandleAtlas
};