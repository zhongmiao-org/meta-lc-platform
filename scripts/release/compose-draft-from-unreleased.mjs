import { loadAggregatePackage, loadRootReleaseNotes, loadWorkspacePackages } from "./package-catalog.mjs";

const args = process.argv.slice(2);
const outputJson = args.includes("--json");
const versionFlagIndex = args.indexOf("--version");
const requestedVersion = versionFlagIndex >= 0 ? args[versionFlagIndex + 1] : "";

const aggregate = loadAggregatePackage();
const version = requestedVersion || aggregate.version;
const rootNotes = loadRootReleaseNotes();
const packages = loadWorkspacePackages().filter((pkg) => pkg.unreleasedEn || pkg.unreleasedZh);

if (!rootNotes.unreleasedEn && !rootNotes.unreleasedZh && packages.length === 0) {
  console.error("No unreleased changelog content found.");
  process.exit(1);
}

const catalog = loadWorkspacePackages();
const metadata = {
  version,
  aggregate: {
    name: aggregate.name,
    version,
    packageJsonPath: aggregate.packageJsonPath
  },
  rootNotes,
  packages: packages.map((pkg) => ({
    name: pkg.name,
    version: pkg.version,
    dir: pkg.dir,
    includedInAggregate: pkg.includedInAggregate,
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
  `# Release Draft: ${aggregate.name}@${version}`,
  "",
  "## Aggregate Package",
  `- package: ${aggregate.name}@${version}`,
  `- included dependencies: ${catalog
    .filter((pkg) => pkg.includedInAggregate)
    .map((pkg) => pkg.name)
    .join(", ")}`,
  ""
];

if (rootNotes.unreleasedEn) {
  lines.push("## Platform Notes", "", rootNotes.unreleasedEn, "");
}

if (packages.length > 0) {
  lines.push("## Package Notes", "");
  for (const pkg of packages) {
    lines.push(`### ${pkg.name}`, "");
    if (pkg.unreleasedEn) {
      lines.push(pkg.unreleasedEn, "");
    } else {
      lines.push("- Chinese-only changelog content present; see the zh-CN changelog.", "");
    }
  }
}

process.stdout.write(`${lines.join("\n").trimEnd()}\n`);
