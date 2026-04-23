import { test } from "node:test";
import assert from "node:assert/strict";
import { MutationOrchestratorService } from "../src/application/orchestrator/mutation-orchestrator.service";

test("mutation orchestrator rejects unsupported tables", async () => {
  const service = new MutationOrchestratorService({} as never, {} as never);

  await assert.rejects(
    async () =>
      service.execute({
        table: "users",
        operation: "create",
        tenantId: "tenant-a",
        userId: "user-a",
        roles: ["USER"],
        data: {
          id: "U-1",
          owner: "Alice"
        }
      }),
    /only orders table is supported/i
  );
});

test("mutation orchestrator requires owner for create and update", async () => {
  const service = new MutationOrchestratorService({} as never, {} as never);

  await assert.rejects(
    async () =>
      service.execute({
        table: "orders",
        operation: "create",
        tenantId: "tenant-a",
        userId: "user-a",
        roles: ["USER"],
        data: {
          id: "SO-1"
        },
        orgId: "dept-a"
      }),
    /owner is required/i
  );
});

test("mutation orchestrator denies out-of-scope update with 403", async () => {
  const service = new MutationOrchestratorService(
    {
      findOrderById: async () => ({
        id: "SO-2001",
        tenant_id: "tenant-a",
        created_by: "manager-1",
        org_id: "dept-b"
      })
    } as never,
    {
      resolveContext: async () => ({
        tenantId: "tenant-a",
        userId: "user-a",
        roles: ["USER"],
        userOrgIds: ["dept-a"],
        rolePolicies: [{ role: "USER", scope: "DEPT" }],
        orgNodes: []
      })
    } as never
  );

  await assert.rejects(
    async () =>
      service.execute({
        table: "orders",
        operation: "update",
        tenantId: "tenant-a",
        userId: "user-a",
        roles: ["USER"],
        orgId: "dept-b",
        key: { id: "SO-2001" },
        data: {
          id: "SO-2001",
          owner: "No Access"
        }
      }),
    /data scope permission denied/i
  );
});

test("mutation orchestrator allows custom org set create within configured org", async () => {
  let receivedOrgId: string | null = null;
  const service = new MutationOrchestratorService(
    {
      mutateOrder: async (command: { orgId: string | null }) => {
        receivedOrgId = command.orgId;
        return {
          rowCount: 1,
          beforeData: null,
          afterData: { id: "SO-CUSTOM-1", org_id: command.orgId }
        };
      }
    } as never,
    {
      resolveContext: async () => ({
        tenantId: "tenant-a",
        userId: "custom-user",
        roles: ["CUSTOM_SUPPORT"],
        userOrgIds: [],
        rolePolicies: [{ role: "CUSTOM_SUPPORT", scope: "CUSTOM_ORG_SET", customOrgIds: ["dept-b"] }],
        orgNodes: []
      })
    } as never
  );

  const result = await service.execute({
    table: "orders",
    operation: "create",
    tenantId: "tenant-a",
    userId: "custom-user",
    roles: ["CUSTOM_SUPPORT"],
    orgId: "dept-b",
    data: {
      id: "SO-CUSTOM-1",
      owner: "Custom Access"
    }
  });

  assert.equal(result.rowCount, 1);
  assert.equal(receivedOrgId, "dept-b");
  assert.equal(result.permissionDecision.scope, "CUSTOM_ORG_SET");
});

test("mutation orchestrator denies SELF scope update for another creator", async () => {
  const service = new MutationOrchestratorService(
    {
      findOrderById: async () => ({
        id: "SO-SELF-1",
        tenant_id: "tenant-a",
        created_by: "owner-a",
        org_id: "dept-a"
      })
    } as never,
    {
      resolveContext: async () => ({
        tenantId: "tenant-a",
        userId: "self-user",
        roles: ["SELF_ONLY"],
        userOrgIds: ["dept-a"],
        rolePolicies: [],
        orgNodes: []
      })
    } as never
  );

  await assert.rejects(
    async () =>
      service.execute({
        table: "orders",
        operation: "update",
        tenantId: "tenant-a",
        userId: "self-user",
        roles: ["SELF_ONLY"],
        key: { id: "SO-SELF-1" },
        data: {
          id: "SO-SELF-1",
          owner: "No Access"
        }
      }),
    /data scope permission denied/i
  );
});
