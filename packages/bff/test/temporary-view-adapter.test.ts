import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { TemporaryViewAdapter } from "../src/application/services/temporary-view-adapter.service";
import { MetaRegistryService } from "../src/application/services/meta-registry.service";

test("temporary view adapter executes runtime view and propagates context into the query node", async () => {
  const queryCalls: Array<{ kind: string; sql: string; params: unknown[] }> = [];
  const registry = new MetaRegistryService();
  const adapter = new TemporaryViewAdapter(
    registry,
    {
      async resolveContext(input: { tenantId: string; userId: string; roles: string[] }) {
        assert.deepEqual(input, {
          tenantId: "tenant-a",
          userId: "user-a",
          roles: ["USER"]
        });
        return {
          tenantId: input.tenantId,
          userId: input.userId,
          roles: input.roles,
          userOrgIds: ["dept-a"],
          rolePolicies: [],
          orgNodes: []
        };
      }
    } as never,
    {
      create() {
        return {
          queryDatasource: {
            async execute(request: { kind: "query"; sql: string; params?: unknown[] }) {
              queryCalls.push({
                kind: request.kind,
                sql: request.sql,
                params: request.params ?? []
              });
              return {
                rows: [
                  {
                    id: "order-1",
                    owner: "Ada",
                    channel: "web",
                    priority: "medium",
                    status: "active"
                  }
                ],
                rowCount: 1,
                metadata: {
                  kind: request.kind,
                  durationMs: 1
                }
              };
            }
          },
          mutationDatasource: {
            async execute() {
              throw new Error("mutation should not be called for the fixture view");
            }
          }
        };
      }
    } as never
  );

  const result = await adapter.execute(
    "orders-workbench",
    {
      tenantId: "tenant-a",
      userId: "user-a",
      roles: ["USER"],
      input: {
        owner: "Ada",
        limit: 2
      },
      context: {
        locale: "zh-CN"
      }
    },
    "req-view-1"
  );

  assert.equal(result.requestId, "req-view-1");
  assert.equal(result.viewName, "orders-workbench");
  assert.deepEqual(queryCalls, [
    {
      kind: "query",
      sql: 'SELECT "id", "owner", "channel", "priority", "status" FROM "orders" WHERE "tenant_id" = $1 AND "owner" = $2 AND "created_by" = $3 LIMIT 2',
      params: ["tenant-a", "Ada", "user-a"]
    }
  ]);
  assert.deepEqual(result.runtime.viewModel, {
    requestId: "req-view-1",
    tenantId: "tenant-a",
    owner: "Ada",
    rows: [
      {
        id: "order-1",
        owner: "Ada",
        channel: "web",
        priority: "medium",
        status: "active"
      }
    ]
  });
});

test("temporary view adapter returns a stable 404 when the view is missing", async () => {
  const adapter = new TemporaryViewAdapter(
    new MetaRegistryService(),
    {
      async resolveContext() {
        return {
          tenantId: "tenant-a",
          userId: "user-a",
          roles: ["USER"],
          userOrgIds: [],
          rolePolicies: [],
          orgNodes: []
        };
      }
    } as never,
    {
      create() {
        throw new Error("runtime dependencies should not be created");
      }
    } as never
  );

  await assert.rejects(
    () =>
      adapter.execute(
        "missing-view",
        {
          tenantId: "tenant-a",
          userId: "user-a",
          roles: ["USER"]
        },
        "req-view-2"
      ),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.equal(error.message, 'view "missing-view" not found');
      return true;
    }
  );
});
