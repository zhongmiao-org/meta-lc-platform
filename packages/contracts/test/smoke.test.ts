import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRuntimePageTopic,
  createRuntimeManagerExecutedEvent,
  RUNTIME_MANAGER_EXECUTED_EVENT,
  type MutationApiResponse,
  type QueryApiRequest,
  type QueryApiResponse,
  type RuntimeManagerExecutedEvent,
  type RuntimeFunctionCallDefinition,
  type RuntimePageDsl,
  type RuntimeRuleDefinition,
  type RuntimeRefreshEvent,
  type RuntimeRefreshPlan,
  type RuntimeTemplateDependency
} from "../src";

test("contracts exports query request type", () => {
  const req: QueryApiRequest = {
    table: "orders",
    fields: ["id"],
    tenantId: "tenant-a",
    userId: "u1",
    roles: ["USER"]
  };
  assert.equal(req.table, "orders");
});

test("contracts exports query and mutation response types", () => {
  const queryResponse: QueryApiResponse = {
    rows: [{ id: "order-1" }]
  };
  const mutationResponse: MutationApiResponse = {
    rowCount: 1,
    row: { id: "order-1" }
  };

  assert.equal(queryResponse.rows[0]?.id, "order-1");
  assert.equal(mutationResponse.rowCount, 1);
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
