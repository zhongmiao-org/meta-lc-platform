import test from "node:test";
import assert from "node:assert/strict";
import {
  createRecordingRuntimeManagerAdapter,
  executeRuntimeManagerPlan,
  type RuntimeManagerPlan
} from "../src";

function createPlan(): RuntimeManagerPlan {
  return {
    refreshPlan: {
      triggeredBy: { type: "state.changed", stateKeys: ["filter"] },
      targetOrder: [
        { kind: "datasource", id: "orders" },
        { kind: "action", id: "notify" }
      ],
      datasourceIds: ["orders"],
      actionIds: ["notify"]
    },
    ruleEffects: {
      triggeredBy: { type: "state.changed", stateKeys: ["filter"] },
      matchedRuleIds: ["reload"],
      patchState: { shouldReload: true },
      refreshDatasourceIds: ["orders"],
      runActionIds: ["notify"]
    },
    nextState: {
      filter: "PAID",
      shouldReload: false
    },
    managerCommands: [
      { type: "patchState", patch: { shouldReload: true } },
      { type: "refreshDatasource", datasourceId: "orders" },
      { type: "runAction", actionId: "notify" }
    ],
    wsTopics: ["tenant.tenant-a.page.orders.instance.instance-1"]
  };
}

test("executeRuntimeManagerPlan executes commands in plan order", async () => {
  const plan = createPlan();
  const adapter = createRecordingRuntimeManagerAdapter();
  const result = await executeRuntimeManagerPlan({ plan, adapter });

  assert.deepEqual(adapter.calls, plan.managerCommands);
  assert.deepEqual(result.commandResults, [
    { type: "patchState", patch: { shouldReload: true } },
    { type: "refreshDatasource", datasourceId: "orders", result: { datasourceId: "orders" } },
    { type: "runAction", actionId: "notify", result: { actionId: "notify" } }
  ]);
});

test("executeRuntimeManagerPlan merges patch state and forwards ws topics", async () => {
  const plan = createPlan();
  const result = await executeRuntimeManagerPlan({
    plan,
    adapter: createRecordingRuntimeManagerAdapter()
  });

  assert.deepEqual(result.nextState, {
    filter: "PAID",
    shouldReload: true
  });
  assert.deepEqual(result.wsTopics, ["tenant.tenant-a.page.orders.instance.instance-1"]);
});

test("executeRuntimeManagerPlan fails fast when adapter throws", async () => {
  const plan = createPlan();
  const calls: string[] = [];

  await assert.rejects(
    () =>
      executeRuntimeManagerPlan({
        plan,
        adapter: {
          patchState: () => {
            calls.push("patchState");
          },
          refreshDatasource: () => {
            calls.push("refreshDatasource");
            throw new Error("datasource failed");
          },
          runAction: () => {
            calls.push("runAction");
          }
        }
      }),
    /datasource failed/
  );

  assert.deepEqual(calls, ["patchState", "refreshDatasource"]);
});
