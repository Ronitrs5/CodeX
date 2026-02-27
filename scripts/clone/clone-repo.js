const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const configPath = path.resolve(__dirname, "../../config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const { githubToken, githubRepo, branchFrom, newFeatureBranchName } = config;

if (!githubToken || !githubRepo || !branchFrom || !newFeatureBranchName) {
  console.error("❌ Missing config values");
  process.exit(1);
}

const parentDir = path.resolve(__dirname, "../..");
const generatedRoot = path.join(parentDir, "Generated");
const cloneDir = path.join(generatedRoot, "Cloned-Game");

if (!fs.existsSync(generatedRoot)) {
  fs.mkdirSync(generatedRoot);
}

if (fs.existsSync(cloneDir)) {
  console.log("⚠️ Cloned-Game already exists. Deleting...");
  fs.rmSync(cloneDir, { recursive: true, force: true });
}

try {
  console.log("🚀 Cloning repository...");

  const repoWithToken = githubRepo.replace(
    "https://",
    `https://${githubToken}@`
  );

  execSync(
    `git clone -b ${branchFrom} ${repoWithToken} ${cloneDir}`,
    { stdio: "inherit" }
  );

  console.log("🌿 Creating new feature branch...");

  execSync(`git checkout -b ${newFeatureBranchName}`, {
    cwd: cloneDir,
    stdio: "inherit",
  });

  console.log("✅ Clone and branch creation complete.");
} catch (err) {
  console.error("❌ Error:", err.message);
  process.exit(1);
}