import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDataScopeFilter,
  buildRowLevelFilter,
  canAccessOrg,
  injectPermissionClause,
  resolveDataScope
} from "../src/domain/permission-engine";

test("non-admin defaults to SELF scope", () => {
  const filter = buildRowLevelFilter({
    tenantId: "t1",
    userId: "u1",
    roles: ["USER"]
  });
  assert.equal(filter.clause, "tenant_id = $1 AND created_by = $2");
  assert.deepEqual(filter.params, ["t1", "u1"]);
});

test("resolveDataScope computes manager dept-children org set", () => {
  const decision = resolveDataScope({
    tenantId: "tenant-a",
    userId: "manager-1",
    roles: ["MANAGER"],
    userOrgIds: ["dept-a"],
    rolePolicies: [],
    orgNodes: [
      {
        id: "dept-a",
        tenantId: "tenant-a",
        parentId: "root",
        path: "root/dept-a",
        name: "部门A",
        type: "department"
      },
      {
        id: "dept-a-sub",
        tenantId: "tenant-a",
        parentId: "dept-a",
        path: "root/dept-a/dept-a-sub",
        name: "部门A-子组",
        type: "department"
      },
      {
        id: "dept-b",
        tenantId: "tenant-a",
        parentId: "root",
        path: "root/dept-b",
        name: "部门B",
        type: "department"
      }
    ]
  });

  assert.equal(decision.scope, "DEPT_AND_CHILDREN");
  assert.deepEqual(new Set(decision.allowedOrgIds), new Set(["dept-a", "dept-a-sub"]));
});

test("buildDataScopeFilter uses org list and legacy fallback", () => {
  const filter = buildDataScopeFilter(
    {
      scope: "DEPT",
      allowedOrgIds: ["dept-a"],
      tenantAll: false,
      legacyFallbackToCreatedBy: true,
      reason: "scope:DEPT"
    },
    {
      tenantId: "tenant-a",
      userId: "u-a",
      roles: ["USER"]
    }
  );

  assert.equal(
    filter.clause,
    "tenant_id = $1 AND (org_id = ANY($2::text[]) OR (org_id IS NULL AND created_by = $3))"
  );
  assert.deepEqual(filter.params, ["tenant-a", ["dept-a"], "u-a"]);
});

test("canAccessOrg denies sibling org and allows legacy fallback", () => {
  const decision = {
    scope: "DEPT" as const,
    allowedOrgIds: ["dept-a"],
    tenantAll: false,
    legacyFallbackToCreatedBy: true,
    reason: "scope:DEPT"
  };

  const denied = canAccessOrg(
    decision,
    { orgId: "dept-b", createdBy: "u-a" },
    { tenantId: "tenant-a", userId: "u-a", roles: ["USER"] }
  );
  assert.equal(denied.allowed, false);

  const allowedByLegacy = canAccessOrg(
    decision,
    { orgId: null, createdBy: "u-a" },
    { tenantId: "tenant-a", userId: "u-a", roles: ["USER"] }
  );
  assert.equal(allowedByLegacy.allowed, true);
  assert.equal(allowedByLegacy.fallbackUsed, true);
});

test("resolveDataScope keeps custom org set from role policy", () => {
  const decision = resolveDataScope({
    tenantId: "tenant-a",
    userId: "custom-user",
    roles: ["CUSTOM_SUPPORT"],
    userOrgIds: ["dept-a"],
    rolePolicies: [{ role: "CUSTOM_SUPPORT", scope: "CUSTOM_ORG_SET", customOrgIds: ["dept-b"] }],
    orgNodes: []
  });

  assert.equal(decision.scope, "CUSTOM_ORG_SET");
  assert.deepEqual(decision.allowedOrgIds, ["dept-b"]);
});

test("canAccessOrg enforces SELF scope by creator only", () => {
  const denied = canAccessOrg(
    {
      scope: "SELF",
      allowedOrgIds: [],
      tenantAll: false,
      legacyFallbackToCreatedBy: true,
      reason: "scope:SELF"
    },
    { orgId: "dept-a", createdBy: "someone-else" },
    { tenantId: "tenant-a", userId: "self-user", roles: ["SELF_ONLY"] }
  );

  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "self-owner-required");
});

test("injectPermissionClause appends filter to SQL with WHERE", () => {
  const sql = injectPermissionClause("SELECT * FROM orders WHERE status = $1", {
    clause: "tenant_id = $2",
    params: ["t1"]
  });
  assert.equal(sql, "SELECT * FROM orders WHERE status = $1 AND tenant_id = $2");
});
