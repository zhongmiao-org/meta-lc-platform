import test from "node:test";
import assert from "node:assert/strict";
import {
  createRuntimeManagerExecutionWsEvent,
  type RuntimeManagerExecutionResult
} from "../src";

const page = {
  tenantId: "tenant-a",
  pageId: "orders",
  pageInstanceId: "instance-1"
};

test("createRuntimeManagerExecutionWsEvent summarizes manager command results", () => {
  const executionResult: RuntimeManagerExecutionResult = {
    nextState: {
      filter: "PAID",
      shouldReload: true
    },
    commandResults: [
      { type: "patchState", patch: { shouldReload: true } },
      { type: "refreshDatasource", datasourceId: "orders", result: { datasourceId: "orders" } },
      { type: "runAction", actionId: "notify", result: { actionId: "notify" } }
    ],
    wsTopics: ["tenant.tenant-a.page.orders.instance.instance-1"]
  };

  assert.deepEqual(
    createRuntimeManagerExecutionWsEvent({
      page,
      requestId: "req-1",
      executionResult
    }),
    {
      type: "runtime.manager.executed",
      topic: "tenant.tenant-a.page.orders.instance.instance-1",
      page,
      requestId: "req-1",
      patchState: { shouldReload: true },
      refreshedDatasourceIds: ["orders"],
      runActionIds: ["notify"]
    }
  );
});

test("createRuntimeManagerExecutionWsEvent handles empty command results", () => {
  const executionResult: RuntimeManagerExecutionResult = {
    nextState: {},
    commandResults: [],
    wsTopics: ["tenant.tenant-a.page.orders.instance.instance-1"]
  };

  assert.deepEqual(createRuntimeManagerExecutionWsEvent({ page, executionResult }), {
    type: "runtime.manager.executed",
    topic: "tenant.tenant-a.page.orders.instance.instance-1",
    page,
    patchState: {},
    refreshedDatasourceIds: [],
    runActionIds: []
  });
});
