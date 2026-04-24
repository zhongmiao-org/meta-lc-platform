import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { TemporaryViewAdapter } from "../src/application/view/temporary-view-adapter.service";
import { MetaRegistryService } from "../src/application/services/meta-registry.service";

test("temporary view adapter executes runtime view and propagates context into the query node", async () => {
  const queryCalls: Array<{ sql: string; params: Array<string | number | boolean> }> = [];
  const registry = new MetaRegistryService();
  const adapter = new TemporaryViewAdapter(
    registry,
    {
      async query(sql: string, params: Array<string | number | boolean>) {
        queryCalls.push({ sql, params });
        return [
          {
            id: "order-1",
            owner: "Ada",
            channel: "web",
            priority: "medium",
            status: "active"
          }
        ];
      },
      async health() {
        return true;
      },
      async mutateOrder() {
        throw new Error("mutation should not be called for the fixture view");
      },
      async findOrderById() {
        return null;
      }
    } as never,
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
      async query() {
        throw new Error("should not be called");
      },
      async health() {
        return true;
      },
      async mutateOrder() {
        throw new Error("should not be called");
      },
      async findOrderById() {
        return null;
      }
    } as never,
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
