import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRowLevelFilter, injectPermissionClause } from "../src/permission-engine";

test("non-admin gets tenant and user filter", () => {
  const filter = buildRowLevelFilter({
    tenantId: "t1",
    userId: "u1",
    roles: ["USER"]
  });
  assert.equal(filter.clause, "tenant_id = $1 AND created_by = $2");
  assert.deepEqual(filter.params, ["t1", "u1"]);
});

test("injectPermissionClause appends filter to SQL with WHERE", () => {
  const sql = injectPermissionClause("SELECT * FROM orders WHERE status = $1", {
    clause: "tenant_id = $2",
    params: ["t1"]
  });
  assert.equal(sql, "SELECT * FROM orders WHERE status = $1 AND tenant_id = $2");
});
