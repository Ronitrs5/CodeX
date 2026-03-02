const strictKeywords = [
  "splash",
  "initial",
  "init",
  "loader",
  "preload",
  "loading",
  "boot"
];

function isStrictAsset(fileName) {
  const lower = fileName.toLowerCase();
  return strictKeywords.some(keyword => lower.includes(keyword));
}

module.exports = { isStrictAsset, strictKeywords };
