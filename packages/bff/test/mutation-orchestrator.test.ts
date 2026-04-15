import { test } from "node:test";
import assert from "node:assert/strict";
import { MutationOrchestratorService } from "../src/orchestration/mutation-orchestrator.service";

test("mutation orchestrator rejects unsupported tables", async () => {
  const service = new MutationOrchestratorService({} as never);

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
  const service = new MutationOrchestratorService({} as never);

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
        }
      }),
    /owner is required/i
  );
});
