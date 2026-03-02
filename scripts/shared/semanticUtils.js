const sharp = require("sharp");
const Tesseract = require("tesseract.js");
const fs = require("fs-extra");

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

  await preprocessImage(imagePath, tempPath);

  const { data: { text } } = await Tesseract.recognize(
    tempPath,
    "eng",
    {
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZxX"
    }
  );

  await fs.remove(tempPath);

  return normalizeText(text);
}

async function semanticCompare(parentPath, newPath) {
  const parentText = await extractText(parentPath);
  const newText = await extractText(newPath);

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