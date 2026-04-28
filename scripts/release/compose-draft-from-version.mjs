import fs from "node:fs";
import { readVersionFromFile } from "./changelog-utils.mjs";

const args = process.argv.slice(2);
const versionFlagIndex = args.indexOf("--version");
const requestedVersion = versionFlagIndex >= 0 ? args[versionFlagIndex + 1] : "";
const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = requestedVersion || rootPackage.version;

const notes = readVersionFromFile("CHANGELOG.md", version);
if (!notes) {
  console.error(`No root changelog section found for ${version}.`);
  process.exit(1);
}

const lines = [`# Release Draft: ${rootPackage.name}@${version}`, "", notes];
process.stdout.write(`${lines.join("\n").trimEnd()}\n`);
