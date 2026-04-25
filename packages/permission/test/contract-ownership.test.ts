import test from "node:test";
import assert from "node:assert/strict";
import type {
  DataScopeDecision,
  OrgScopeContext,
  RoleDataPolicy
} from "../src";

test("permission owns org and data-scope DTO contracts", () => {
  const policy: RoleDataPolicy = {
    role: "USER",
    scope: "SELF"
  };
  const context: OrgScopeContext = {
    tenantId: "tenant-a",
    userId: "user-a",
    roles: [policy.role],
    userOrgIds: [],
    rolePolicies: [policy],
    orgNodes: []
  };
  const decision: DataScopeDecision = {
    scope: policy.scope,
    allowedOrgIds: [],
    tenantAll: false,
    legacyFallbackToCreatedBy: true,
    reason: "self"
  };

  assert.equal(context.rolePolicies[0]?.scope, "SELF");
  assert.equal(decision.legacyFallbackToCreatedBy, true);
});
