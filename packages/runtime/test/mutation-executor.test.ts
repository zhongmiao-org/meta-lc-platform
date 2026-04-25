import test from "node:test";
import assert from "node:assert/strict";
import {
  executeMutationNode,
  type MutationDatasourceAdapter,
  type RuntimeContext,
  type RuntimeStateStore
} from "../src";
import type { MutationNodeDefinition } from "@zhongmiao/meta-lc-kernel";

const runtimeInput = {
  tenantId: "tenant-a",
  enabled: true,
  operation: "create",
  model: "orders",
  orderId: "order-1",
  status: "PAID"
};

const runtimeContext: RuntimeContext = {
  input: runtimeInput,
  traceId: "trace-1"
};

const runtimeState: RuntimeStateStore = {
  get(path: string): unknown {
    if (path === "save.afterData.id") {
      return "order-1";
    }

    if (path === "save.afterData.status") {
      return "PAID";
    }

    return undefined;
  }
};

function createAdapter(
  onExecute: (command: Parameters<MutationDatasourceAdapter["execute"]>[0]) => Promise<unknown> | unknown
): MutationDatasourceAdapter {
  return {
    async execute(command) {
      return (await onExecute(command)) as never;
    }
  };
}

function createMutationNode(overrides: Partial<MutationNodeDefinition> = {}): MutationNodeDefinition {
  return {
    type: "mutation",
    model: "{{input.model}}",
    operation: "{{input.operation}}",
    payload: {
      id: "{{input.orderId}}",
      status: "{{input.status}}",
      traceId: "{{traceId}}",
      prevId: "{{save.afterData.id}}"
    },
    condition: "{{input.enabled}}",
    ...overrides
  };
}

test("executeMutationNode resolves payload expressions and calls the adapter", async () => {
  const calls: Array<Parameters<MutationDatasourceAdapter["execute"]>[0]> = [];
  const result = await executeMutationNode(
    createMutationNode(),
    runtimeState,
    runtimeContext,
    {
      adapter: createAdapter(async (command) => {
        calls.push(command);
        return {
          rowCount: 1,
          row: { id: "order-1" },
          beforeData: null,
          afterData: { id: "order-1", status: "PAID" }
        };
      })
    }
  );

  assert.deepEqual(calls, [
    {
      model: "orders",
      operation: "create",
      payload: {
        id: "order-1",
        status: "PAID",
        traceId: "trace-1",
        prevId: "order-1"
      },
      context: runtimeContext
    }
  ]);
  assert.deepEqual(result, {
    skipped: false,
    model: "orders",
    operation: "create",
    payload: {
      id: "order-1",
      status: "PAID",
      traceId: "trace-1",
      prevId: "order-1"
    },
    rowCount: 1,
    row: { id: "order-1" },
    beforeData: null,
    afterData: { id: "order-1", status: "PAID" },
    condition: true
  });
});

test("executeMutationNode skips the adapter when condition resolves to false", async () => {
  let executed = false;
  const result = await executeMutationNode(
    createMutationNode({
      condition: "{{input.skip}}"
    }),
    runtimeState,
    {
      ...runtimeContext,
      input: {
        ...runtimeInput,
        skip: false
      }
    },
    {
      adapter: createAdapter(async () => {
        executed = true;
        return {
          rowCount: 1,
          row: null,
          beforeData: null,
          afterData: null
        };
      })
    }
  );

  assert.equal(executed, false);
  assert.deepEqual(result, {
    skipped: true,
    model: "orders",
    operation: "create",
    payload: {
      id: "order-1",
      status: "PAID",
      traceId: "trace-1",
      prevId: "order-1"
    },
    rowCount: 0,
    row: null,
    beforeData: null,
    afterData: null,
    condition: false
  });
});

test("executeMutationNode rejects invalid mutation contracts", async () => {
  await assert.rejects(
    () =>
      executeMutationNode(
        {
          type: "mutation",
          model: "",
          operation: "create",
          payload: {}
        },
        runtimeState,
        runtimeContext,
        {
          adapter: createAdapter(async () => ({
            rowCount: 1,
            row: null,
            beforeData: null,
            afterData: null
          }))
        }
      ),
    /model/
  );
});
