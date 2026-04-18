import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const dist = path.join(root, "dist");

fs.mkdirSync(dist, { recursive: true });
for (const file of ["index.js", "index.d.ts"]) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}
