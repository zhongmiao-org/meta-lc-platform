import test from "node:test";
import assert from "node:assert/strict";
import pkg from "../package.json" with { type: "json" };

test("aggregate package keeps the platform package identity", () => {
  assert.equal(pkg.name, "@zhongmiao/meta-lc-platform");
  assert.equal(pkg.dependencies["@zhongmiao/meta-lc-runtime"], "workspace:*");
});
