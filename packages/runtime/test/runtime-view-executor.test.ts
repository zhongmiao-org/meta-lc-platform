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
  const queryCalls: Array<{ kind: string; sql: string; params: unknown[] }> = [];

  const result = await executeRuntimeView(
    view,
    {
      input: {
        tenantId: "tenant-a"
      }
    },
    {
      queryDatasource: {
        async execute(request) {
          queryCalls.push({
            kind: request.kind,
            sql: request.sql,
            params: request.params ?? []
          });
          return {
            rows: [{ id: "order-1", owner: "Ada" }],
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
          throw new Error("mutation adapter should not be called");
        }
      }
    }
  );

  assert.deepEqual(queryCalls, [
    {
      kind: "query",
      sql: 'SELECT "id", "owner" FROM "orders" WHERE "tenant_id" = $1 LIMIT 100',
      params: ["tenant-a"]
    }
  ]);
  assert.deepEqual(result.viewModel, {
    rows: [{ id: "order-1", owner: "Ada" }],
    firstOwner: "Ada"
  });
});
