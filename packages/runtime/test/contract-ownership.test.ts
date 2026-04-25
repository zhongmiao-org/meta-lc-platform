import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRuntimePageTopic,
  createRuntimeManagerExecutedEvent,
  type ExecutionPlan,
  type RuntimePageDsl,
  type ViewDefinition
} from "../src";

test("runtime owns V2 view, execution, DSL, and websocket event contracts", () => {
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
  const plan: ExecutionPlan = {
    nodes: [
      {
        id: "orders",
        type: "query",
        definition: view.nodes.orders
      }
    ],
    edges: {
      orders: []
    },
    output: view.output
  };
  const dsl: RuntimePageDsl = {
    schemaVersion: "runtime-page-dsl.v1",
    pageMeta: {
      id: "orders",
      title: "Orders"
    },
    state: {},
    datasources: [],
    actions: [],
    layoutTree: []
  };
  const topic = buildRuntimePageTopic({
    tenantId: "tenant-a",
    pageId: dsl.pageMeta.id,
    pageInstanceId: "instance-1"
  });

  assert.equal(plan.nodes[0]?.id, "orders");
  assert.equal(topic, "tenant.tenant-a.page.orders.instance.instance-1");
  assert.equal(
    createRuntimeManagerExecutedEvent({
      page: {
        tenantId: "tenant-a",
        pageId: "orders",
        pageInstanceId: "instance-1"
      }
    }).type,
    "runtime.manager.executed"
  );
});
