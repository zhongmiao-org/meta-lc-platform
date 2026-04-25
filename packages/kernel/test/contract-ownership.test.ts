import test from "node:test";
import assert from "node:assert/strict";
import type {
  DatasourceDefinition,
  PermissionPolicy,
  ViewDefinition
} from "../src";

test("kernel exposes datasource and permission policy definitions with runtime-owned views", () => {
  const view: ViewDefinition = {
    name: "orders-workbench",
    nodes: {
      orders: {
        type: "query",
        table: "orders",
        fields: ["id"]
      }
    },
    output: {
      rows: "{{orders.rows}}"
    }
  };
  const datasource: DatasourceDefinition = {
    id: "orders-db",
    type: "postgres",
    config: {
      target: "business"
    }
  };
  const policy: PermissionPolicy = {
    id: "orders-read",
    resource: "orders",
    action: "read",
    roles: ["USER"],
    scope: "SELF"
  };

  assert.equal(view.name, "orders-workbench");
  assert.equal(datasource.type, "postgres");
  assert.equal(policy.scope, "SELF");
});
