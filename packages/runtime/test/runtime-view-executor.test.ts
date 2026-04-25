import assert from "node:assert/strict";
import test from "node:test";
import type { ViewDefinition } from "@zhongmiao/meta-lc-kernel";
import { executeRuntimeView } from "../src";

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
      tenantId: "tenant-a",
      userId: "user-1",
      roles: ["USER"],
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
      sql: 'SELECT "id", "owner" FROM "orders" WHERE ("tenant_id" = $1) AND ("tenant_id" = $2 AND "created_by" = $3) LIMIT 100',
      params: ["tenant-a", "tenant-a", "user-1"]
    }
  ]);
  assert.deepEqual(result.viewModel, {
    rows: [{ id: "order-1", owner: "Ada" }],
    firstOwner: "Ada"
  });
});
