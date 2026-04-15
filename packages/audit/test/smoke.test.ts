import test from "node:test";
import assert from "node:assert/strict";
import { AuditService } from "../src";

test("audit service class exists", () => {
  assert.equal(typeof AuditService, "function");
});
