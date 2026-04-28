import { execFileSync } from "node:child_process";
import fs from "node:fs";

const [baseSha, headSha] = process.argv.slice(2);
if (!baseSha || !headSha) {
  console.error("Usage: check-changelog-gate.mjs <base-sha> <head-sha>");
  process.exit(1);
}

const changedFiles = execFileSync("git", ["diff", "--name-only", baseSha, headSha], {
  encoding: "utf8"
})
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const changedSet = new Set(changedFiles);
const required = new Set();

for (const file of changedFiles) {
  if (file === "CHANGELOG.md" || file === "CHANGELOG.zh-CN.md") {
    continue;
  }

  const packageMatch = file.match(/^packages\/([^/]+)\//);
  if (packageMatch) {
    if (!fs.existsSync(`packages/${packageMatch[1]}`)) {
      continue;
    }
    required.add(`packages/${packageMatch[1]}/CHANGELOG.md`);
    required.add(`packages/${packageMatch[1]}/CHANGELOG.zh-CN.md`);
    continue;
  }

  if (file.startsWith(".changeset/")) {
    continue;
  }

  required.add("CHANGELOG.md");
  required.add("CHANGELOG.zh-CN.md");
}

const missing = [...required].filter((file) => !changedSet.has(file));
if (missing.length > 0) {
  console.error("Missing required changelog updates:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("Changelog gate passed.");
