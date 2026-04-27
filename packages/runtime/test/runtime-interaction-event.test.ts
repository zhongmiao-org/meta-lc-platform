import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRuntimePageTopic,
  type RuntimePageDsl
} from "./runtime-test-api";
import {
  planRuntimeManagerEvent,
  parseRuntimePageDsl,
  RuntimeDependencyGraphError,
  RuntimeRuleEngineError
} from "./runtime-test-api";

function createRuntimeDsl(): RuntimePageDsl {
  return {
    schemaVersion: "runtime-page-dsl.v1",
    pageMeta: {
      id: "orders-page",
      title: "Orders Page"
    },
    state: {
      tenantId: "tenant-a",
      filter_status: "PAID",
      selectedOrderId: "",
      tableData: [],
      detailData: null,
      shouldReload: false
    },
    datasources: [
      {
        id: "orders-query-datasource",
        type: "rest",
        request: {
          params: {
            status: "{{state.filter_status}}"
          }
        },
        responseMapping: {
          stateKey: "tableData"
        }
      },
      {
        id: "order-detail-datasource",
        type: "rest",
        request: {
          params: {
            id: "{{state.selectedOrderId}}"
          }
        },
        responseMapping: {
          stateKey: "detailData"
        }
      }
    ],
    actions: [
      {
        id: "select-order-action",
        trigger: "state.changed",
        steps: [
          {
            type: "setState",
            patch: {
              selectedOrderId: "{{state.selectedOrderId}}"
            }
          }
        ]
      },
      {
        id: "save-order-action",
        steps: [{ type: "callMutation" }],
        onSuccess: {
          refreshDatasources: ["orders-query-datasource"],
          runActions: ["select-order-action"]
        }
      },
      {
        id: "notify-action",
        steps: [{ type: "toast", message: "saved" }]
      }
    ],
    rules: [
      {
        id: "reload-paid-orders-rule",
        trigger: "state.changed",
        condition: {
          call: {
            name: "eq",
            args: [
              { source: "state", key: "filter_status" },
              { source: "literal", value: "PAID" }
            ]
          }
        },
        effects: [
          {
            type: "setState",
            stateKey: "shouldReload",
            value: { source: "literal", value: true }
          },
          {
            type: "refreshDatasource",
            datasourceId: "orders-query-datasource"
          },
          {
            type: "runAction",
            actionId: "notify-action"
          }
        ]
      }
    ],
    layoutTree: []
  };
}

test("planRuntimeManagerEvent parses raw DSL and creates a stable interaction plan", async () => {
  const dsl = createRuntimeDsl();
  const plan = await planRuntimeManagerEvent({
    dsl,
    state: dsl.state,
    event: {
      type: "state.changed",
      stateKeys: ["selectedOrderId", "filter_status"]
    },
    pageInstance: {
      tenantId: "tenant-a",
      pageId: "orders-page",
      pageInstanceId: "instance-1"
    }
  });

  assert.deepEqual(plan.refreshPlan.targetOrder, [
    { kind: "datasource", id: "orders-query-datasource" },
    { kind: "action", id: "select-order-action" },
    { kind: "datasource", id: "order-detail-datasource" }
  ]);
  assert.deepEqual(plan.ruleEffects.matchedRuleIds, ["reload-paid-orders-rule"]);
  assert.deepEqual(plan.nextState, {
    ...dsl.state,
    shouldReload: true
  });
  assert.deepEqual(plan.managerCommands, [
    {
      type: "patchState",
      patch: {
        shouldReload: true
      }
    },
    {
      type: "refreshDatasource",
      datasourceId: "orders-query-datasource"
    },
    {
      type: "refreshDatasource",
      datasourceId: "order-detail-datasource"
    },
    {
      type: "runAction",
      actionId: "select-order-action"
    },
    {
      type: "runAction",
      actionId: "notify-action"
    }
  ]);
  assert.deepEqual(plan.wsTopics, ["tenant.tenant-a.page.orders-page.instance.instance-1"]);
});

test("planRuntimeManagerEvent accepts parsed DSL and preserves mutation refresh order", async () => {
  const dsl = createRuntimeDsl();
  const parsedDsl = parseRuntimePageDsl(dsl);
  const plan = await planRuntimeManagerEvent({
    dsl: parsedDsl,
    state: dsl.state,
    event: {
      type: "mutation.succeeded",
      actionId: "save-order-action",
      operation: "update"
    }
  });

  assert.deepEqual(plan.ruleEffects.matchedRuleIds, []);
  assert.deepEqual(plan.nextState, dsl.state);
  assert.deepEqual(plan.managerCommands, [
    {
      type: "refreshDatasource",
      datasourceId: "orders-query-datasource"
    },
    {
      type: "refreshDatasource",
      datasourceId: "order-detail-datasource"
    },
    {
      type: "runAction",
      actionId: "select-order-action"
    }
  ]);
  assert.deepEqual(plan.wsTopics, []);
});

test("runtime interaction event planning keeps graph and rule errors observable", async () => {
  const dsl = createRuntimeDsl();
  await assert.rejects(
    () =>
      planRuntimeManagerEvent({
        dsl,
        state: dsl.state,
        event: {
          type: "state.changed",
          stateKeys: ["missingState"]
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeDependencyGraphError);
      assert.equal(error.message, 'Unknown state key "missingState" in state.changed event.');
      return true;
    }
  );

  await assert.rejects(
    () =>
      planRuntimeManagerEvent({
        dsl: {
          ...dsl,
          rules: [
            {
              id: "broken-rule",
              trigger: "state.changed",
              condition: {
                call: {
                  name: "notEmpty",
                  args: [{ source: "literal", value: "ok" }]
                }
              },
              effects: [
                {
                  type: "refreshDatasource",
                  datasourceId: "missing-datasource"
                }
              ]
            }
          ]
        },
        state: dsl.state,
        event: {
          type: "state.changed",
          stateKeys: ["filter_status"]
        }
      }),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeRuleEngineError);
      assert.equal(error.message, 'Rule effect references unknown datasource "missing-datasource".');
      return true;
    }
  );
});

test("runtime page topic helper matches the BFF websocket baseline", () => {
  assert.equal(
    buildRuntimePageTopic({
      tenantId: "tenant-a",
      pageId: "orders-page",
      pageInstanceId: "instance-1"
    }),
    "tenant.tenant-a.page.orders-page.instance.instance-1"
  );
});
