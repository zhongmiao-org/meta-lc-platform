import fs from "node:fs";
import { readVersionFromFile } from "./changelog-utils.mjs";
import { loadWorkspacePackages } from "./package-catalog.mjs";

const args = process.argv.slice(2);
const versionFlagIndex = args.indexOf("--version");
const requestedVersion = versionFlagIndex >= 0 ? args[versionFlagIndex + 1] : "";
const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = requestedVersion || rootPackage.version;

const rootNotes = readVersionFromFile("CHANGELOG.md", version);
const packages = loadWorkspacePackages()
  .map((pkg) => ({
    ...pkg,
    versionNotesEn: readVersionFromFile(pkg.changelogPathEn, version),
    versionNotesZh: readVersionFromFile(pkg.changelogPathZh, version)
  }))
  .filter((pkg) => pkg.versionNotesEn || pkg.versionNotesZh);

if (!rootNotes && packages.length === 0) {
  console.error(`No changelog sections found for ${version}.`);
  process.exit(1);
}

const lines = [
  "## Release Summary",
  "",
  `- root package: ${rootPackage.name}@${version}`,
  `- workspace packages: ${loadWorkspacePackages()
    .map((pkg) => pkg.name)
    .join(", ")}`,
  `- packages with changelog entries: ${packages.length}`,
  ""
];

if (rootNotes) {
  lines.push("## Root Changelog", "", "### CHANGELOG.md", rootNotes, "");
}

if (packages.length > 0) {
  lines.push("## Package Changes", "");
  for (const pkg of packages) {
    lines.push(`### ${pkg.name} -> ${version}`, "");
    if (pkg.versionNotesEn) {
      lines.push(pkg.versionNotesEn, "");
    } else {
      lines.push("- Chinese-only changelog content present; see the zh-CN changelog.", "");
    }
  }
}

process.stdout.write(`${lines.join("\n").trimEnd()}\n`);
