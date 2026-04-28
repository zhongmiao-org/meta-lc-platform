import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const expectedPrefix = "@zhongmiao/meta-lc-";
const packageDirs = ["packages", "apps"];
const violations = [];
const rootPackage = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const rootVersion = rootPackage.version;
const workspacePackageNames = new Set();
const rootChangelog = fs.existsSync(path.join(ROOT, "CHANGELOG.md"))
  ? fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8").replace(/\r\n/g, "\n")
  : "";
const isReleaseManifestState = new RegExp(`^## ${rootVersion.replaceAll(".", "\\.")} \\(\\d{4}-\\d{2}-\\d{2}\\)`, "m").test(
  rootChangelog
);

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
    if (pkg.name) {
      workspacePackageNames.add(pkg.name);
    }
  }
}

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
    if (pkg.version !== rootVersion) {
      violations.push(`${path.relative(ROOT, packageJsonPath)} must use root version ${rootVersion}.`);
    }
    if (isReleaseManifestState) {
      for (const dependencyField of ["dependencies", "peerDependencies", "optionalDependencies", "devDependencies"]) {
        for (const [dependencyName, dependencyVersion] of Object.entries(pkg[dependencyField] ?? {})) {
          if (workspacePackageNames.has(dependencyName) && dependencyVersion !== rootVersion) {
            violations.push(
              `${path.relative(ROOT, packageJsonPath)} must pin internal ${dependencyField} ${dependencyName} to ${rootVersion}.`
            );
          }
        }
      }
    }
    if (baseDir === "packages" && pkg.private !== true) {
      if (pkg.publishConfig?.access !== "public") {
        violations.push(`${path.relative(ROOT, packageJsonPath)} must set publishConfig.access to public.`);
      }
      const files = Array.isArray(pkg.files) ? pkg.files : [];
      for (const requiredFile of ["dist", "README.md", "README_zh.md", "CHANGELOG.md", "CHANGELOG.zh-CN.md"]) {
        if (!files.includes(requiredFile)) {
          violations.push(`${path.relative(ROOT, packageJsonPath)} must include ${requiredFile} in files.`);
        }
      }
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
