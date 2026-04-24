import { test } from "node:test";
import assert from "node:assert/strict";
import { compileQueryWithPermission } from "../src/application/orchestrator/query.orchestrator";

test("compileQueryWithPermission injects DEPT scope filter", () => {
  const compiled = compileQueryWithPermission({
    table: "orders",
    fields: ["id", "status"],
    filters: { keyword: "SO-1", status: "PAID" },
    tenantId: "t1",
    userId: "u1",
    roles: ["USER"],
    limit: 20
  }, {
    scope: "DEPT",
    allowedOrgIds: ["dept-a"],
    tenantAll: false,
    legacyFallbackToCreatedBy: true,
    reason: "scope:DEPT"
  });

  assert.equal(
    compiled.sql,
    'SELECT "id", "status" FROM "orders" WHERE ("id" ILIKE $1 OR "owner" ILIKE $1) AND "status" = $2 AND tenant_id = $3 AND (org_id = ANY($4::text[]) OR (org_id IS NULL AND created_by = $5)) LIMIT 20'
  );
  assert.deepEqual(compiled.params, ["%SO-1%", "PAID", "t1", ["dept-a"], "u1"]);
});

test("compileQueryWithPermission injects tenant-only filter for TENANT_ALL", () => {
  const compiled = compileQueryWithPermission({
    table: "orders",
    fields: ["id"],
    filters: { status: "PAID" },
    tenantId: "t1",
    userId: "u1",
    roles: ["SUPER_ADMIN"]
  }, {
    scope: "TENANT_ALL",
    allowedOrgIds: [],
    tenantAll: true,
    legacyFallbackToCreatedBy: false,
    reason: "scope:TENANT_ALL"
  });

  assert.equal(compiled.sql, 'SELECT "id" FROM "orders" WHERE "status" = $1 AND tenant_id = $2 LIMIT 100');
  assert.deepEqual(compiled.params, ["PAID", "t1"]);
});

test("compileQueryWithPermission injects custom org scope filter", () => {
  const compiled = compileQueryWithPermission({
    table: "orders",
    fields: ["id"],
    filters: {},
    tenantId: "tenant-a",
    userId: "custom-user",
    roles: ["CUSTOM_SUPPORT"]
  }, {
    scope: "CUSTOM_ORG_SET",
    allowedOrgIds: ["dept-b"],
    tenantAll: false,
    legacyFallbackToCreatedBy: true,
    reason: "scope:CUSTOM_ORG_SET"
  });

  assert.equal(
    compiled.sql,
    'SELECT "id" FROM "orders" WHERE tenant_id = $1 AND (org_id = ANY($2::text[]) OR (org_id IS NULL AND created_by = $3)) LIMIT 100'
  );
  assert.deepEqual(compiled.params, ["tenant-a", ["dept-b"], "custom-user"]);
});
