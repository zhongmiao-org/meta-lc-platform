import { test } from "node:test";
import assert from "node:assert/strict";
import { compileQueryWithPermission } from "../src/query-pipeline.service";

test("compileQueryWithPermission injects tenant/user filters", () => {
  const compiled = compileQueryWithPermission({
    table: "orders",
    fields: ["id", "status"],
    filters: { keyword: "SO-1", status: "PAID" },
    tenantId: "t1",
    userId: "u1",
    roles: ["USER"],
    limit: 20
  });

  assert.equal(
    compiled.sql,
    'SELECT "id", "status" FROM "orders" WHERE ("id" ILIKE $1 OR "owner" ILIKE $1) AND "status" = $2 AND tenant_id = $3 AND created_by = $4 LIMIT 20'
  );
  assert.deepEqual(compiled.params, ["%SO-1%", "PAID", "t1", "u1"]);
});

test("compileQueryWithPermission skips tenant/user filters for SUPER_ADMIN", () => {
  const compiled = compileQueryWithPermission({
    table: "orders",
    fields: ["id"],
    filters: { status: "PAID" },
    tenantId: "t1",
    userId: "u1",
    roles: ["SUPER_ADMIN"]
  });

  assert.equal(compiled.sql, 'SELECT "id" FROM "orders" WHERE "status" = $1 LIMIT 100');
  assert.deepEqual(compiled.params, ["PAID"]);
});
