import fs from "node:fs";
import { loadRootReleaseNotes, loadWorkspacePackages } from "./package-catalog.mjs";

const args = process.argv.slice(2);
const outputJson = args.includes("--json");
const versionFlagIndex = args.indexOf("--version");
const requestedVersion = versionFlagIndex >= 0 ? args[versionFlagIndex + 1] : "";

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = requestedVersion || rootPackage.version;
const rootNotes = loadRootReleaseNotes();
const packages = loadWorkspacePackages().filter((pkg) => pkg.unreleasedEn || pkg.unreleasedZh);

if (!rootNotes.unreleasedEn && !rootNotes.unreleasedZh && packages.length === 0) {
  console.error("No unreleased changelog content found.");
  process.exit(1);
}

const catalog = loadWorkspacePackages();
const metadata = {
  version,
  rootPackage: {
    name: rootPackage.name,
    version,
    packageJsonPath: "package.json"
  },
  rootNotes,
  packages: packages.map((pkg) => ({
    name: pkg.name,
    version: pkg.version,
    dir: pkg.dir,
    packageJsonPath: pkg.packageJsonPath,
    changelogPathEn: pkg.changelogPathEn,
    changelogPathZh: pkg.changelogPathZh,
    unreleasedEn: pkg.unreleasedEn,
    unreleasedZh: pkg.unreleasedZh
  }))
};

if (outputJson) {
  process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
  process.exit(0);
}

const lines = [
  "## Release Summary",
  "",
  `- root package: ${rootPackage.name}@${version}`,
  `- workspace packages: ${catalog.map((pkg) => pkg.name).join(", ")}`,
  `- packages with changelog entries: ${packages.length}`,
  ""
];

if (rootNotes.unreleasedEn) {
  lines.push("## Root Changelog (Unreleased)", "", "### CHANGELOG.md", rootNotes.unreleasedEn, "");
}

if (packages.length > 0) {
  lines.push("## Package Changes", "");
  for (const pkg of packages) {
    lines.push(`### ${pkg.name} -> ${version}`, "");
    if (pkg.unreleasedEn) {
      lines.push(pkg.unreleasedEn, "");
    } else {
      lines.push("- Chinese-only changelog content present; see the zh-CN changelog.", "");
    }
  }
}

process.stdout.write(`${lines.join("\n").trimEnd()}\n`);
