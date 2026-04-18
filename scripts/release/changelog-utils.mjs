import fs from "node:fs";

const UNRELEASED_HEADER = "## [Unreleased]";

export function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

export function extractUnreleased(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const buffer = [];
  let inSection = false;

  for (const line of lines) {
    if (line.trim() === UNRELEASED_HEADER) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("## ")) {
      break;
    }
    if (inSection) {
      buffer.push(line);
    }
  }

  return buffer.join("\n").trim();
}

export function readUnreleasedFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return "";
  }
  return extractUnreleased(readFile(filePath));
}

export function finalizeUnreleasedSection(filePath, version, date) {
  const content = readFile(filePath);
  const unreleased = extractUnreleased(content);
  if (!unreleased) {
    return false;
  }

  const releaseHeading = `## ${version} (${date})`;
  const lines = content.split("\n");
  const output = [];
  let inSection = false;
  let sectionHandled = false;

  for (const line of lines) {
    if (!sectionHandled && line.trim() === UNRELEASED_HEADER) {
      output.push(line);
      output.push("");
      output.push(releaseHeading);
      output.push("");
      output.push(...unreleased.split("\n"));
      inSection = true;
      sectionHandled = true;
      continue;
    }
    if (inSection) {
      if (line.startsWith("## ")) {
        output.push("");
        output.push(line);
        inSection = false;
      }
      continue;
    }
    output.push(line);
  }

  const normalized = output.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
  fs.writeFileSync(filePath, `${normalized}\n`, "utf8");
  return true;
}
