import fs from "node:fs";
import path from "node:path";
import { readUnreleasedFromFile, readVersionFromFile } from "./changelog-utils.mjs";

const ROOT = process.cwd();
const PACKAGES_DIR = path.join(ROOT, "packages");

function readReleaseNotes(filePath, version) {
  return readUnreleasedFromFile(filePath) || readVersionFromFile(filePath, version);
}

export function loadWorkspacePackages(version = "") {
  return fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .map((dir) => {
      const packageJsonPath = path.join(PACKAGES_DIR, dir, "package.json");
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      const changelogPathEn = path.join(PACKAGES_DIR, dir, "CHANGELOG.md");
      const changelogPathZh = path.join(PACKAGES_DIR, dir, "CHANGELOG.zh-CN.md");

      return {
        dir,
        name: pkg.name,
        version: pkg.version,
        packageJsonPath: path.relative(ROOT, packageJsonPath),
        changelogPathEn: path.relative(ROOT, changelogPathEn),
        changelogPathZh: path.relative(ROOT, changelogPathZh),
        unreleasedEn: readReleaseNotes(changelogPathEn, version),
        unreleasedZh: readReleaseNotes(changelogPathZh, version)
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function loadRootReleaseNotes(version = "") {
  return {
    changelogPathEn: "CHANGELOG.md",
    changelogPathZh: "CHANGELOG.zh-CN.md",
    unreleasedEn: readReleaseNotes(path.join(ROOT, "CHANGELOG.md"), version),
    unreleasedZh: readReleaseNotes(path.join(ROOT, "CHANGELOG.zh-CN.md"), version)
  };
}
