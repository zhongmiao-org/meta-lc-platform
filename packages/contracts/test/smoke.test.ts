import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRuntimePageTopic,
  createRuntimeManagerExecutedEvent,
  RUNTIME_MANAGER_EXECUTED_EVENT,
  type DatasourceDefinition,
  type ExecutionPlan,
  type PermissionPolicy,
  type ViewDefinition,
  type RuntimeManagerExecutedEvent,
  type RuntimeFunctionCallDefinition,
  type RuntimePageDsl,
  type RuntimeRuleDefinition,
  type RuntimeRefreshEvent,
  type RuntimeRefreshPlan,
  type RuntimeTemplateDependency
} from "../src";

test("contracts exports V2 view and execution plan contracts", () => {
  const view: ViewDefinition = {
    name: "orders-workbench",
    nodes: {
      orders: {
        type: "query",
        table: "orders",
        fields: ["id"],
        filters: {
          tenant_id: "{{input.tenantId}}"
        }
      }
    },
    output: {
      rows: "{{orders.rows}}"
    }
  };
  const ordersNode = view.nodes.orders;
  assert.ok(ordersNode);
  const plan: ExecutionPlan = {
    nodes: [
      {
        id: "orders",
        type: "query",
        definition: ordersNode
      }
    ],
    edges: {
      orders: []
    },
    output: view.output
  };

  assert.equal(view.nodes.orders?.type, "query");
  assert.equal(plan.nodes[0]?.id, "orders");
});

test("contracts exports meta definition registry contracts", () => {
  const datasource: DatasourceDefinition = {
    id: "orders-query",
    type: "postgres",
    config: {
      target: "business"
    }
  };
  const policy: PermissionPolicy = {
    id: "orders-query-policy",
    resource: "orders",
    action: "query",
    roles: ["SALES"],
    scope: "DEPT"
  };

  assert.equal(datasource.id, "orders-query");
  assert.equal(policy.scope, "DEPT");
});

test("contracts exports runtime dsl types", () => {
  const dependency: RuntimeTemplateDependency = {
    source: "state",
    key: "tenantId",
    expression: "{{state.tenantId}}"
  };
  const dsl: RuntimePageDsl = {
    schemaVersion: "runtime-page-dsl.v1",
    pageMeta: {
      id: "orders-query-page",
      title: "Orders Query"
    },
    state: {
      tenantId: "tenant-a"
    },
    datasources: [],
    actions: [],
    rules: [],
    layoutTree: []
  };

  assert.equal(dependency.key, "tenantId");
  assert.equal(dsl.pageMeta.id, "orders-query-page");
});

test("contracts exports runtime rule and function types", () => {
  const conditionCall: RuntimeFunctionCallDefinition = {
    name: "eq",
    args: [
      { source: "state", key: "filter_status" },
      { source: "literal", value: "PAID" }
    ]
  };
  const rule: RuntimeRuleDefinition = {
    id: "refresh-paid-orders-rule",
    trigger: "state.changed",
    condition: {
      call: conditionCall
    },
    effects: [
      {
        type: "refreshDatasource",
        datasourceId: "orders-query-datasource"
      }
    ]
  };

  assert.equal(rule.trigger, "state.changed");
  assert.equal(rule.condition.call.name, "eq");
});

test("contracts exports runtime refresh planning types", () => {
  const event: RuntimeRefreshEvent = {
    type: "mutation.succeeded",
    actionId: "save-order-action",
    operation: "update"
  };
  const plan: RuntimeRefreshPlan = {
    datasourceIds: ["orders-query-datasource"],
    actionIds: [],
    targetOrder: [{ kind: "datasource", id: "orders-query-datasource" }],
    triggeredBy: event
  };

  assert.equal(plan.triggeredBy.type, "mutation.succeeded");
  assert.equal(plan.targetOrder[0]?.kind, "datasource");
});

test("contracts exports runtime page topic helper", () => {
  assert.equal(
    buildRuntimePageTopic({
      tenantId: "tenant-a",
      pageId: "orders-page",
      pageInstanceId: "instance-1"
    }),
    "tenant.tenant-a.page.orders-page.instance.instance-1"
  );
});

test("contracts exports runtime manager executed event helper", () => {
  const event: RuntimeManagerExecutedEvent = createRuntimeManagerExecutedEvent({
    page: {
      tenantId: "tenant-a",
      pageId: "orders-page",
      pageInstanceId: "instance-1"
    },
    requestId: "req-1",
    patchState: { status: "PAID" },
    refreshedDatasourceIds: ["orders"],
    runActionIds: ["notify"]
  });

  assert.equal(RUNTIME_MANAGER_EXECUTED_EVENT, "runtimeManagerExecuted");
  assert.deepEqual(event, {
    type: "runtime.manager.executed",
    topic: "tenant.tenant-a.page.orders-page.instance.instance-1",
    page: {
      tenantId: "tenant-a",
      pageId: "orders-page",
      pageInstanceId: "instance-1"
    },
    requestId: "req-1",
    patchState: { status: "PAID" },
    refreshedDatasourceIds: ["orders"],
    runActionIds: ["notify"]
  });
});

test("contracts accepts runtime manager executed replay cursor", () => {
  const event: RuntimeManagerExecutedEvent = {
    type: "runtime.manager.executed",
    topic: "tenant.tenant-a.page.orders-page.instance.instance-1",
    page: {
      tenantId: "tenant-a",
      pageId: "orders-page",
      pageInstanceId: "instance-1"
    },
    replayId: "1710000000000-0",
    patchState: {},
    refreshedDatasourceIds: [],
    runActionIds: []
  };

  assert.equal(event.replayId, "1710000000000-0");
});
