import test from "node:test";
import assert from "node:assert/strict";
import type { QueryApiRequest } from "../src";

test("contracts exports query request type", () => {
  const req: QueryApiRequest = {
    table: "orders",
    fields: ["id"],
    tenantId: "tenant-a",
    userId: "u1",
    roles: ["USER"]
  };
  assert.equal(req.table, "orders");
});
