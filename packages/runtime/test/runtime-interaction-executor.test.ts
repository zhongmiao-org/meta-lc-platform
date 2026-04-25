import test from "node:test";
import assert from "node:assert/strict";
import {
  createRecordingRuntimeInteractionPort,
  executeRuntimeInteractionPlan,
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

test("executeRuntimeInteractionPlan executes commands in plan order", async () => {
  const plan = createPlan();
  const port = createRecordingRuntimeInteractionPort();
  const result = await executeRuntimeInteractionPlan({ plan, port });

  assert.deepEqual(port.calls, plan.managerCommands);
  assert.deepEqual(result.commandResults, [
    { type: "patchState", patch: { shouldReload: true } },
    { type: "refreshDatasource", datasourceId: "orders", result: { datasourceId: "orders" } },
    { type: "runAction", actionId: "notify", result: { actionId: "notify" } }
  ]);
});

test("executeRuntimeInteractionPlan merges patch state and forwards ws topics", async () => {
  const plan = createPlan();
  const result = await executeRuntimeInteractionPlan({
    plan,
    port: createRecordingRuntimeInteractionPort()
  });

  assert.deepEqual(result.nextState, {
    filter: "PAID",
    shouldReload: true
  });
  assert.deepEqual(result.wsTopics, ["tenant.tenant-a.page.orders.instance.instance-1"]);
});

test("executeRuntimeInteractionPlan fails fast when port throws", async () => {
  const plan = createPlan();
  const calls: string[] = [];

  await assert.rejects(
    () =>
      executeRuntimeInteractionPlan({
        plan,
        port: {
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
