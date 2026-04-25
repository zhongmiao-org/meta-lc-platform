import test from "node:test";
import assert from "node:assert/strict";
import type {
  DatasourceDefinition,
  NodeDefinition,
  PermissionPolicy,
  ViewDefinition
} from "../src";

test("kernel owns view, node, datasource, and permission policy structure contracts", () => {
  const node: NodeDefinition = {
    type: "query",
    table: "orders",
    fields: ["id"]
  };
  const view: ViewDefinition = {
    name: "orders-workbench",
    nodes: {
      orders: node
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
