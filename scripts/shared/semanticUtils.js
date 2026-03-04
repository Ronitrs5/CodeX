const sharp = require("sharp");
const Tesseract = require("tesseract.js");
const fs = require("fs-extra");
const path = require("path");

const defaultTesseractCachePath = path.resolve(__dirname, "../../Generated/tesseract-cache");

const tesseractOptions = {
  cachePath: process.env.TESSERACT_CACHE_PATH || defaultTesseractCachePath,
};

if (process.env.TESSERACT_LANG_PATH) {
  tesseractOptions.langPath = process.env.TESSERACT_LANG_PATH;
}

function hasLocalEnglishData() {
  const langPath = tesseractOptions.langPath;
  if (!langPath) return false;

  const candidates = [
    path.join(langPath, "eng.traineddata"),
    path.join(langPath, "eng.traineddata.gz"),
  ];

  return candidates.some((candidatePath) => fs.existsSync(candidatePath));
}

function canRunOcr() {
  if (process.env.TESSERACT_ONLINE_MODE === "1") return true;
  return hasLocalEnglishData();
}

function normalizeText(text) {
  return text
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9X]/gi, "")
    .toUpperCase();
}

function extractNumbers(text) {
  const match = text.match(/\d+/g);
  return match ? match.map(Number) : [];
}

async function preprocessImage(inputPath, outputPath) {
  await sharp(inputPath)
    .grayscale()
    .normalize()
    .threshold(150)
    .toFile(outputPath);
}

async function extractText(imagePath) {
  const tempPath = imagePath + "_processed.png";

  try {
    await preprocessImage(imagePath, tempPath);

    const { data: { text } } = await Tesseract.recognize(
      tempPath,
      "eng",
      {
        ...tesseractOptions,
        tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZxX"
      }
    );

    return normalizeText(text);
  } finally {
    await fs.remove(tempPath).catch(() => {});
  }
}

async function semanticCompare(parentPath, newPath) {
  if (!canRunOcr()) {
    return {
      status: "OCR_UNAVAILABLE",
      severity: "INFO",
      parentText: "",
      newText: "",
      error: "Tesseract language data unavailable. Set TESSERACT_LANG_PATH to a folder containing eng.traineddata(.gz), or set TESSERACT_ONLINE_MODE=1."
    };
  }

  let parentText;
  let newText;

  try {
    parentText = await extractText(parentPath);
    newText = await extractText(newPath);
  } catch (error) {
    return {
      status: "OCR_UNAVAILABLE",
      severity: "INFO",
      parentText: "",
      newText: "",
      error: error && error.message ? error.message : String(error)
    };
  }

  const parentNumbers = extractNumbers(parentText);
  const newNumbers = extractNumbers(newText);

  if (JSON.stringify(parentNumbers) !== JSON.stringify(newNumbers)) {
    return {
      status: "NUMERIC_MISMATCH",
      severity: "CRITICAL",
      parentText,
      newText
    };
  }

  if (parentText !== newText) {
    return {
      status: "TEXT_MISMATCH",
      severity: "WARNING",
      parentText,
      newText
    };
  }

  return {
    status: "OK",
    severity: "INFO",
    parentText,
    newText
  };
}

module.exports = { semanticCompare };