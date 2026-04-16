import { test } from "node:test";
import assert from "node:assert/strict";
import { MutationOrchestratorService } from "../src/orchestration/mutation-orchestrator.service";

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
