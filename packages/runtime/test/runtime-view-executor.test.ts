import assert from "node:assert/strict";
import test from "node:test";
import { executeRuntimeView, type ViewDefinition } from "../src";

test("executeRuntimeView compiles a view and executes through the runtime entrypoint", async () => {
  const view: ViewDefinition = {
    name: "orders-workbench",
    nodes: {
      orders: {
        type: "query",
        table: "orders",
        fields: ["id", "owner"],
        filters: {
          tenant_id: "{{input.tenantId}}"
        }
      }
    },
    output: {
      rows: "{{orders.rows}}",
      firstOwner: "{{orders.row.owner}}"
    }
  };
  const queryCalls: Array<{ sql: string; params: Array<string | number | boolean> }> = [];

  const result = await executeRuntimeView(
    view,
    {
      input: {
        tenantId: "tenant-a"
      }
    },
    {
      queryDatasource: {
        async query(sql, params = []) {
          queryCalls.push({ sql, params });
          return [{ id: "order-1", owner: "Ada" }];
        }
      },
      mutationDatasource: {
        async execute() {
          throw new Error("mutation adapter should not be called");
        }
      }
    }
  );

  assert.deepEqual(queryCalls, [
    {
      sql: 'SELECT "id", "owner" FROM "orders" WHERE "tenant_id" = $1 LIMIT 100',
      params: ["tenant-a"]
    }
  ]);
  assert.deepEqual(result.viewModel, {
    rows: [{ id: "order-1", owner: "Ada" }],
    firstOwner: "Ada"
  });
});
