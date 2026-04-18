import test from "node:test";
import assert from "node:assert/strict";
import type { RuntimePageDsl } from "@zhongmiao/meta-lc-contracts";
import {
  buildDependencyGraph,
  parseRuntimePageDsl,
  planRefresh,
  RuntimeDependencyGraphError
} from "../src";

function createRuntimeDsl(): RuntimePageDsl {
  return {
    schemaVersion: "runtime-page-dsl.v1",
    pageMeta: {
      id: "orders-crud-page",
      title: "Orders CRUD"
    },
    state: {
      tenantId: "tenant-a",
      filter_status: "PAID",
      tableData: [],
      selectedOrderId: "",
      detailData: null
    },
    datasources: [
      {
        id: "orders-query-datasource",
        type: "rest",
        request: {
          method: "POST",
          url: "/query",
          params: {
            tenantId: "{{state.tenantId}}",
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
          method: "POST",
          url: "/query",
          params: {
            tenantId: "{{state.tenantId}}",
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
        steps: [
          {
            type: "callMutation",
            stateKey: "selectedOrderId"
          }
        ],
        onSuccess: {
          refreshDatasources: ["orders-query-datasource"],
          runActions: ["select-order-action"]
        }
      }
    ],
    layoutTree: []
  };
}

test("buildDependencyGraph creates stable state and mutation mappings", () => {
  const graph = buildDependencyGraph(parseRuntimePageDsl(createRuntimeDsl()));

  assert.deepEqual(graph.stateToTargets.filter_status, [{ kind: "datasource", id: "orders-query-datasource" }]);
  assert.deepEqual(graph.stateToTargets.selectedOrderId, [
    { kind: "datasource", id: "order-detail-datasource" },
    { kind: "action", id: "select-order-action" }
  ]);
  assert.deepEqual(graph.mutationSuccess["save-order-action"], [
    { kind: "datasource", id: "orders-query-datasource" },
    { kind: "action", id: "select-order-action" }
  ]);
});

test("buildDependencyGraph rejects unknown state dependencies and missing success targets", () => {
  assert.throws(
    () =>
      buildDependencyGraph(
        parseRuntimePageDsl({
          ...createRuntimeDsl(),
          datasources: [
            {
              id: "broken-datasource",
              type: "rest",
              request: {
                params: {
                  status: "{{state.unknown_key}}"
                }
              }
            }
          ]
        })
      ),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeDependencyGraphError);
      assert.equal(error.message, 'Unknown state dependency "unknown_key" for datasource "broken-datasource".');
      return true;
    }
  );

  assert.throws(
    () =>
      buildDependencyGraph(
        parseRuntimePageDsl({
          ...createRuntimeDsl(),
          actions: [
            {
              id: "save-order-action",
              steps: [{ type: "callMutation" }],
              onSuccess: {
                refreshDatasources: ["missing-datasource"]
              }
            }
          ]
        })
      ),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeDependencyGraphError);
      assert.equal(
        error.message,
        'Action "save-order-action" references unknown datasource "missing-datasource" in onSuccess.refreshDatasources.'
      );
      return true;
    }
  );
});

test("buildDependencyGraph fails fast on explicit dependency cycles", () => {
  assert.throws(
    () =>
      buildDependencyGraph(
        parseRuntimePageDsl({
          ...createRuntimeDsl(),
          state: {
            firstState: "",
            secondState: ""
          },
          datasources: [
            {
              id: "first-datasource",
              type: "rest",
              request: {
                params: {
                  secondState: "{{state.secondState}}"
                }
              },
              responseMapping: {
                stateKey: "firstState"
              }
            },
            {
              id: "second-datasource",
              type: "rest",
              request: {
                params: {
                  firstState: "{{state.firstState}}"
                }
              },
              responseMapping: {
                stateKey: "secondState"
              }
            }
          ],
          actions: [],
          layoutTree: []
        })
      ),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeDependencyGraphError);
      assert.match(error.message, /Runtime dependency cycle detected:/);
      return true;
    }
  );
});

test("planRefresh schedules state-driven refreshes in stable topological order", () => {
  const graph = buildDependencyGraph(parseRuntimePageDsl(createRuntimeDsl()));
  const plan = planRefresh(graph, {
    type: "state.changed",
    stateKeys: ["selectedOrderId", "filter_status"]
  });

  assert.deepEqual(plan.targetOrder, [
    { kind: "datasource", id: "orders-query-datasource" },
    { kind: "action", id: "select-order-action" },
    { kind: "datasource", id: "order-detail-datasource" }
  ]);
  assert.deepEqual(plan.datasourceIds, ["orders-query-datasource", "order-detail-datasource"]);
  assert.deepEqual(plan.actionIds, ["select-order-action"]);
});

test("planRefresh schedules mutation success refreshes and ignores unrelated state", () => {
  const graph = buildDependencyGraph(parseRuntimePageDsl(createRuntimeDsl()));
  const mutationPlan = planRefresh(graph, {
    type: "mutation.succeeded",
    actionId: "save-order-action",
    operation: "update"
  });

  assert.deepEqual(mutationPlan.targetOrder, [
    { kind: "datasource", id: "orders-query-datasource" },
    { kind: "action", id: "select-order-action" },
    { kind: "datasource", id: "order-detail-datasource" }
  ]);

  const statePlan = planRefresh(graph, {
    type: "state.changed",
    stateKeys: ["tenantId"]
  });

  assert.deepEqual(statePlan.targetOrder, [
    { kind: "datasource", id: "order-detail-datasource" },
    { kind: "datasource", id: "orders-query-datasource" }
  ]);
});
