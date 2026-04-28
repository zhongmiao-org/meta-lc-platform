import fs from "node:fs";
import { finalizeUnreleasedSection } from "./changelog-utils.mjs";

const [metadataPath] = process.argv.slice(2).filter((arg) => arg !== "--");
if (!metadataPath) {
  console.error("Usage: finalize-unreleased-changelogs.mjs <metadata-json-path>");
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
const version = String(metadata.version || "").trim();
if (!version) {
  console.error("Release metadata must include a version.");
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
let changed = false;

for (const filePath of ["CHANGELOG.md", "CHANGELOG.zh-CN.md"]) {
  changed = finalizeUnreleasedSection(filePath, version, date) || changed;
}

for (const pkg of metadata.packages ?? []) {
  for (const filePath of [pkg.changelogPathEn, pkg.changelogPathZh]) {
    if (!filePath) {
      continue;
    }
    changed = finalizeUnreleasedSection(filePath, version, date) || changed;
  }
}

if (!changed) {
  console.log("No unreleased changelog content to finalize.");
}
