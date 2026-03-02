const fs = require("fs");
const path = require("path");

function getStructure(obj) {
  if (Array.isArray(obj)) {
    return [getStructure(obj[0])];
  }
  if (obj !== null && typeof obj === "object") {
    const structure = {};
    Object.keys(obj).sort().forEach(key => {
      structure[key] = getStructure(obj[key]);
    });
    return structure;
  }
  return typeof obj;
}

function structuresAreEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function validateJsonStructure(oldJsonPath, newJsonPath) {
  try {
    const oldJson = JSON.parse(fs.readFileSync(oldJsonPath, "utf-8"));
    const newJson = JSON.parse(fs.readFileSync(newJsonPath, "utf-8"));
    const oldStructure = getStructure(oldJson);
    const newStructure = getStructure(newJson);
    return structuresAreEqual(oldStructure, newStructure);
  } catch {
    return false;
  }
}

function flagJsonAsset(jsonFlaggedDir, fileName, oldFile, newFile, oldJsonPath, newJsonPath, ensureDir) {
  const assetFolder = path.join(jsonFlaggedDir, path.parse(fileName).name);
  ensureDir(assetFolder);
  fs.copyFileSync(oldFile, path.join(assetFolder, "original" + path.extname(fileName)));
  fs.copyFileSync(newFile, path.join(assetFolder, "new" + path.extname(fileName)));
  if (oldJsonPath && fs.existsSync(oldJsonPath)) {
    fs.copyFileSync(oldJsonPath, path.join(assetFolder, "original.json"));
  }
  if (newJsonPath && fs.existsSync(newJsonPath)) {
    fs.copyFileSync(newJsonPath, path.join(assetFolder, "new.json"));
  }
  fs.writeFileSync(
    path.join(assetFolder, "details.json"),
    JSON.stringify({ reason: "JSON structure mismatch", asset: fileName }, null, 2)
  );
}

module.exports = { getStructure, structuresAreEqual, validateJsonStructure, flagJsonAsset };
