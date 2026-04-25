import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const expectedPrefix = "@zhongmiao/meta-lc-";
const packageDirs = ["packages", "apps"];
const violations = [];

for (const baseDir of packageDirs) {
  const base = path.join(ROOT, baseDir);
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packageJsonPath = path.join(base, entry.name, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    if (!String(pkg.name || "").startsWith(expectedPrefix)) {
      violations.push(`${path.relative(ROOT, packageJsonPath)} must use the ${expectedPrefix}* prefix.`);
    }
  }
}

if (violations.length > 0) {
  console.error("Version consistency violations:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Version consistency check passed.");
