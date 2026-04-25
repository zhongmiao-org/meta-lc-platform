import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRuntimePageTopic,
  createRuntimeManagerExecutedEvent,
  type ExecutionPlan,
  type RuntimeContext,
  type RuntimePageDsl
} from "../src";

test("runtime owns execution, runtime context, DSL, and websocket event contracts", () => {
  const context: RuntimeContext = {
    requestId: "req-1",
    tenantId: "tenant-a"
  };
  const plan: ExecutionPlan = {
    nodes: [
      {
        id: "orders",
        type: "query",
        definition: {
          type: "query",
          table: "orders",
          fields: ["id"]
        }
      }
    ],
    edges: {
      orders: []
    },
    output: {
      rows: "{{orders.rows}}"
    }
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

  assert.equal(context.requestId, "req-1");
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
