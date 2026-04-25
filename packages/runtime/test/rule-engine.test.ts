import test from "node:test";
import assert from "node:assert/strict";
import type { RuntimePageDsl } from "../src";
import {
  buildDependencyGraph,
  createFunctionRegistry,
  evaluateRules,
  parseRuntimePageDsl,
  RuntimeRuleEngineError
} from "../src";

function createRuntimeDsl(): RuntimePageDsl {
  return {
    schemaVersion: "runtime-page-dsl.v1",
    pageMeta: {
      id: "orders-rule-page",
      title: "Orders Rule Page"
    },
    state: {
      filter_status: "PAID",
      selectedOrderId: "",
      shouldReload: false,
      roles: ["USER"]
    },
    datasources: [
      {
        id: "orders-query-datasource",
        type: "rest",
        request: {
          params: {
            status: "{{state.filter_status}}"
          }
        }
      }
    ],
    actions: [
      {
        id: "load-order-detail-action",
        trigger: "state.changed",
        steps: [{ type: "callDatasource", datasourceId: "orders-query-datasource" }]
      },
      {
        id: "save-order-action",
        steps: [{ type: "callMutation" }]
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
            type: "refreshDatasource",
            datasourceId: "orders-query-datasource"
          },
          {
            type: "setState",
            stateKey: "shouldReload",
            value: {
              source: "literal",
              value: true
            }
          }
        ]
      },
      {
        id: "reload-on-save-rule",
        trigger: "mutation.succeeded",
        condition: {
          call: {
            name: "eq",
            args: [
              { source: "event", key: "actionId" },
              { source: "literal", value: "save-order-action" }
            ]
          }
        },
        effects: [
          {
            type: "runAction",
            actionId: "load-order-detail-action"
          }
        ]
      }
    ],
    layoutTree: []
  };
}

test("evaluateRules only runs matching state.changed rules and returns stable effects", async () => {
  const parsedDsl = parseRuntimePageDsl(createRuntimeDsl());
  const graph = buildDependencyGraph(parsedDsl);
  const plan = await evaluateRules({
    event: {
      type: "state.changed",
      stateKeys: ["filter_status"]
    },
    state: parsedDsl.state,
    parsedDsl,
    graph,
    functionRegistry: createFunctionRegistry()
  });

  assert.deepEqual(plan.matchedRuleIds, ["reload-paid-orders-rule"]);
  assert.deepEqual(plan.refreshDatasourceIds, ["orders-query-datasource"]);
  assert.deepEqual(plan.runActionIds, []);
  assert.deepEqual(plan.patchState, {
    shouldReload: true
  });
});

test("evaluateRules only runs matching mutation.succeeded rules", async () => {
  const parsedDsl = parseRuntimePageDsl(createRuntimeDsl());
  const graph = buildDependencyGraph(parsedDsl);
  const plan = await evaluateRules({
    event: {
      type: "mutation.succeeded",
      actionId: "save-order-action",
      operation: "update"
    },
    state: parsedDsl.state,
    parsedDsl,
    graph,
    functionRegistry: createFunctionRegistry()
  });

  assert.deepEqual(plan.matchedRuleIds, ["reload-on-save-rule"]);
  assert.deepEqual(plan.runActionIds, ["load-order-detail-action"]);
  assert.deepEqual(plan.refreshDatasourceIds, []);
  assert.deepEqual(plan.patchState, {});
});

test("evaluateRules ignores unrelated triggers and unchanged state dependencies", async () => {
  const parsedDsl = parseRuntimePageDsl(createRuntimeDsl());
  const graph = buildDependencyGraph(parsedDsl);

  const statePlan = await evaluateRules({
    event: {
      type: "state.changed",
      stateKeys: ["selectedOrderId"]
    },
    state: parsedDsl.state,
    parsedDsl,
    graph,
    functionRegistry: createFunctionRegistry()
  });

  assert.deepEqual(statePlan.matchedRuleIds, []);

  const mutationPlan = await evaluateRules({
    event: {
      type: "mutation.succeeded",
      actionId: "load-order-detail-action",
      operation: "update"
    },
    state: parsedDsl.state,
    parsedDsl,
    graph,
    functionRegistry: createFunctionRegistry()
  });

  assert.deepEqual(mutationPlan.matchedRuleIds, []);
});

test("evaluateRules fails with stable errors for unknown effect targets and state keys", async () => {
  const invalidDsl = parseRuntimePageDsl({
    ...createRuntimeDsl(),
    rules: [
      {
        id: "broken-rule",
        trigger: "state.changed",
        condition: {
          call: {
            name: "notEmpty",
            args: [{ source: "state", key: "filter_status" }]
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
  });

  await assert.rejects(
    () =>
      evaluateRules({
        event: {
          type: "state.changed",
          stateKeys: ["filter_status"]
        },
        state: invalidDsl.state,
        parsedDsl: invalidDsl,
        graph: buildDependencyGraph(invalidDsl),
        functionRegistry: createFunctionRegistry()
      }),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeRuleEngineError);
      assert.equal(error.message, 'Rule effect references unknown datasource "missing-datasource".');
      return true;
    }
  );

  const invalidStateDsl = parseRuntimePageDsl({
    ...createRuntimeDsl(),
    rules: [
      {
        id: "broken-state-rule",
        trigger: "state.changed",
        condition: {
          call: {
            name: "notEmpty",
            args: [{ source: "literal", value: "ok" }]
          }
        },
        effects: [
          {
            type: "setState",
            stateKey: "missingState",
            value: {
              source: "literal",
              value: true
            }
          }
        ]
      }
    ]
  });

  await assert.rejects(
    () =>
      evaluateRules({
        event: {
          type: "state.changed",
          stateKeys: ["filter_status"]
        },
        state: invalidStateDsl.state,
        parsedDsl: invalidStateDsl,
        graph: buildDependencyGraph(invalidStateDsl),
        functionRegistry: createFunctionRegistry()
      }),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeRuleEngineError);
      assert.equal(error.message, 'Rule effect references unknown state key "missingState".');
      return true;
    }
  );
});
