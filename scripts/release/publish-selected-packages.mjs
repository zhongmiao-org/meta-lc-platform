import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const versionFlagIndex = args.indexOf("--version");
const requestedVersion = versionFlagIndex >= 0 ? args[versionFlagIndex + 1] : "";

const ROOT = process.cwd();
const rootPackage = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const releaseVersion = requestedVersion || rootPackage.version;

function listPackageManifests() {
  const packagesPath = path.join(ROOT, "packages");
  return fs
    .readdirSync(packagesPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(packagesPath, entry.name, "package.json"))
    .filter((filePath) => fs.existsSync(filePath));
}

function isPublished(name, version) {
  try {
    execFileSync("npm", ["view", `${name}@${version}`, "version"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return true;
  } catch {
    return false;
  }
}

const packages = listPackageManifests()
  .map((manifestPath) => {
    const pkg = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return {
      dir: path.dirname(manifestPath),
      manifestPath,
      name: pkg.name,
      version: pkg.version,
      private: pkg.private === true,
      publishConfig: pkg.publishConfig,
      dependencies: {
        ...(pkg.dependencies ?? {}),
        ...(pkg.peerDependencies ?? {})
      }
    };
  })
  .filter((pkg) => !pkg.private);

const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
const sortedPackages = [];
const visiting = new Set();
const visited = new Set();

function visit(pkg) {
  if (visited.has(pkg.name)) {
    return;
  }
  if (visiting.has(pkg.name)) {
    console.error(`Workspace dependency cycle detected at ${pkg.name}.`);
    process.exit(1);
  }
  visiting.add(pkg.name);
  for (const dependencyName of Object.keys(pkg.dependencies)) {
    const dependency = byName.get(dependencyName);
    if (dependency) {
      visit(dependency);
    }
  }
  visiting.delete(pkg.name);
  visited.add(pkg.name);
  sortedPackages.push(pkg);
}

for (const pkg of packages) {
  visit(pkg);
}

for (const pkg of sortedPackages) {
  if (pkg.version !== releaseVersion) {
    console.error(`${path.relative(ROOT, pkg.manifestPath)} has version ${pkg.version}, expected ${releaseVersion}.`);
    process.exit(1);
  }
  if (pkg.publishConfig?.access !== "public") {
    console.error(`${pkg.name} must set publishConfig.access to public before publishing.`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(pkg.dir, "dist"))) {
    console.error(`${pkg.name} is missing dist output. Run pnpm -r build before publishing.`);
    process.exit(1);
  }
}

if (packages.length === 0) {
  console.log("No publishable packages found.");
  process.exit(0);
}

for (const pkg of sortedPackages) {
  if (isPublished(pkg.name, pkg.version)) {
    console.log(`skip ${pkg.name}@${pkg.version}: already published`);
    continue;
  }

  const command = ["publish", "--access", "public", "--tag", "latest", "--no-git-checks"];
  if (dryRun) {
    command.push("--dry-run");
  }

  console.log(`${dryRun ? "dry-run publish" : "publish"} ${pkg.name}@${pkg.version}`);
  const result = spawnSync("pnpm", command, {
    cwd: pkg.dir,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
