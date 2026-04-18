import test from "node:test";
import assert from "node:assert/strict";
import type {
  QueryApiRequest,
  RuntimeFunctionCallDefinition,
  RuntimePageDsl,
  RuntimeRuleDefinition,
  RuntimeRefreshEvent,
  RuntimeRefreshPlan,
  RuntimeTemplateDependency
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
