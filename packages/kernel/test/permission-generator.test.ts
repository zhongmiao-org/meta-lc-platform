import { test } from "node:test";
import assert from "node:assert/strict";
import { compilePermissionManifest } from "../src";
import { ordersCompilerFixture } from "./fixtures/compiler-fixtures";

test("compilePermissionManifest emits stable permission rules", () => {
  const compiled = compilePermissionManifest(ordersCompilerFixture.permissions);

  assert.deepEqual(compiled, ordersCompilerFixture.expected.permission);
});

test("compilePermissionManifest preserves permission input order", () => {
  const compiled = compilePermissionManifest(ordersCompilerFixture.permissions);

  assert.deepEqual(
    compiled.rules.map((rule) => rule.id),
    ["customers.query", "orders.query", "orders.mutation"]
  );
});

test("compilePermissionManifest accepts empty permissions", () => {
  assert.deepEqual(compilePermissionManifest([]), {
    source: "snapshot-permissions",
    rules: []
  });
});

test("compilePermissionManifest rejects invalid permissions", () => {
  assert.throws(
    () => compilePermissionManifest([{ resource: "", action: "query", roles: ["ADMIN"] }]),
    /Permission requires a resource/
  );
  assert.throws(
    () => compilePermissionManifest([{ resource: "orders", action: "", roles: ["ADMIN"] }]),
    /Permission orders requires an action/
  );
  assert.throws(
    () => compilePermissionManifest([{ resource: "orders", action: "query", roles: [] }]),
    /Permission orders:query requires at least one role/
  );
  assert.throws(
    () => compilePermissionManifest([{ resource: "orders", action: "query", roles: ["ADMIN", "ADMIN"] }]),
    /Permission orders:query has duplicate role "ADMIN"/
  );
});
