const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");
const projectRoot = path.resolve(__dirname, "..");

const generatedDir = path.join(projectRoot, "Generated");

const flaggedDir = path.join(generatedDir, "flaggedAssets");
const metricsFile = path.join(generatedDir, "pipelineMetrics.json");

if (fs.existsSync(flaggedDir)) {
  console.log("🧹 Cleaning flaggedAssets...");
  fs.rmSync(flaggedDir, { recursive: true, force: true });
}

if (fs.existsSync(metricsFile)) {
  fs.rmSync(metricsFile, { force: true });
}


function runStep(label, command) {
  console.log(`\n🔹 Running: ${label}`);
  try {
    execSync(command, { stdio: "inherit" });
  } catch (err) {
    console.error(`❌ Failed at step: ${label}`);
    process.exit(1);
  }
}

console.log("\n🚀 SLOT CLONE PIPELINE STARTED\n");

runStep("Clone Repo", "node scripts/clone/clone-repo.js");
runStep("Asset Diff", "node scripts/validation/assetDiff.js");
runStep("Safe Replace + Validation", "node scripts/replace-assets/replace.js");
// runStep("Initial Load Size", "node scripts/validation/initialLoadBundleSize.js");

console.log("\n✅ PIPELINE COMPLETED SUCCESSFULLY\n");