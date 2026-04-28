import fs from "node:fs";
import path from "node:path";
import { finalizeUnreleasedSection } from "./changelog-utils.mjs";
import { loadWorkspacePackages } from "./package-catalog.mjs";

const [metadataPath] = process.argv.slice(2).filter((arg) => arg !== "--");
if (!metadataPath) {
  console.error("Usage: prepare-release-pr.mjs <metadata-json-path>");
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
const version = String(metadata.version || "").trim();
if (!version) {
  console.error("Release metadata must include a version.");
  process.exit(1);
}

const ROOT = process.cwd();
const date = new Date().toISOString().slice(0, 10);
const internalPackageNames = new Set(
  listWorkspaceManifests("packages")
    .map((manifestPath) => JSON.parse(fs.readFileSync(manifestPath, "utf8")).name)
    .filter(Boolean)
);

function updateManifestVersion(filePath) {
  const pkg = JSON.parse(fs.readFileSync(filePath, "utf8"));
  pkg.version = version;
  for (const dependencyField of ["dependencies", "peerDependencies", "optionalDependencies", "devDependencies"]) {
    if (!pkg[dependencyField] || typeof pkg[dependencyField] !== "object") {
      continue;
    }
    for (const dependencyName of Object.keys(pkg[dependencyField])) {
      if (internalPackageNames.has(dependencyName)) {
        pkg[dependencyField][dependencyName] = version;
      }
    }
  }
  fs.writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

function listWorkspaceManifests(baseDir) {
  const basePath = path.join(ROOT, baseDir);
  if (!fs.existsSync(basePath)) {
    return [];
  }
  return fs
    .readdirSync(basePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(basePath, entry.name, "package.json"))
    .filter((filePath) => fs.existsSync(filePath));
}

updateManifestVersion(path.join(ROOT, "package.json"));
for (const manifestPath of [...listWorkspaceManifests("packages"), ...listWorkspaceManifests("apps")]) {
  updateManifestVersion(manifestPath);
}

let changedChangelogs = false;
for (const filePath of ["CHANGELOG.md", "CHANGELOG.zh-CN.md"]) {
  changedChangelogs = finalizeUnreleasedSection(filePath, version, date) || changedChangelogs;
}

for (const pkg of loadWorkspacePackages()) {
  for (const filePath of [pkg.changelogPathEn, pkg.changelogPathZh]) {
    changedChangelogs = finalizeUnreleasedSection(filePath, version, date) || changedChangelogs;
  }
}

if (!changedChangelogs) {
  console.error("No unreleased changelog content was finalized.");
  process.exit(1);
}

console.log(`Prepared release PR changes for ${version}.`);
