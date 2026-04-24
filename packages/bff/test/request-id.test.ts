import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRequestId } from "../src/common/request-id";

test("resolveRequestId reuses incoming request id header", () => {
  const id = resolveRequestId("req-123");
  assert.equal(id, "req-123");
});

test("resolveRequestId uses first value from header array", () => {
  const id = resolveRequestId(["req-abc", "req-def"]);
  assert.equal(id, "req-abc");
});

test("resolveRequestId creates uuid when header missing", () => {
  const id = resolveRequestId(undefined);
  assert.equal(typeof id, "string");
  assert.ok(id.length > 10);
});
