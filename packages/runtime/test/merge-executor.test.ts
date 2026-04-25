import test from "node:test";
import assert from "node:assert/strict";
import {
  executeMergeNode,
  MergeExecutorError,
  type RuntimeContext,
  type RuntimeStateStore
} from "../src";
import type { MergeNodeDefinition } from "@zhongmiao/meta-lc-kernel";

const runtimeState: RuntimeStateStore = {
  get(path: string): unknown {
    const values: Record<string, unknown> = {
      "user.row": { id: "user-1", name: "Ada" },
      "orders.row": { id: "order-1", total: 42 },
      "org.row": { id: "org-1", name: "Acme" },
      "user.rows": [{ id: "user-1" }],
      "orders.rows": [{ id: "order-1" }, { id: "order-2" }],
      "org.rows": [{ id: "org-1" }],
      "user.missing": undefined
    };

    return values[path];
  }
};

const runtimeContext: RuntimeContext = {
  requestId: "req-1"
};

function createMergeNode(overrides: Partial<MergeNodeDefinition> = {}): MergeNodeDefinition {
  return {
    type: "merge",
    strategy: "objectMerge",
    inputs: {
      user: "{{user.row}}",
      orders: "{{orders.row}}",
      org: "{{org.row}}"
    },
    ...overrides
  };
}

test("executeMergeNode performs stable objectMerge fan-in", async () => {
  const node = createMergeNode();
  const snapshot = structuredClone(node);

  const result = await executeMergeNode(node, runtimeState, runtimeContext);

  assert.deepEqual(result, {
    user: { id: "user-1", name: "Ada" },
    orders: { id: "order-1", total: 42 },
    org: { id: "org-1", name: "Acme" }
  });
  assert.deepEqual(node, snapshot);
  assert.deepEqual(Object.keys(result as Record<string, unknown>), ["user", "orders", "org"]);
});

test("executeMergeNode performs arrayConcat in input order", async () => {
  const result = await executeMergeNode(
    {
      type: "merge",
      strategy: "arrayConcat",
      inputs: {
        user: "{{user.rows}}",
        orders: "{{orders.rows}}",
        org: "{{org.rows}}"
      }
    },
    runtimeState,
    runtimeContext
  );

  assert.deepEqual(result, [
    { id: "user-1" },
    { id: "order-1" },
    { id: "order-2" },
    { id: "org-1" }
  ]);
});

test("executeMergeNode rejects missing inputs with a clear error", async () => {
  await assert.rejects(
    () =>
      executeMergeNode(
        {
          type: "merge",
          strategy: "objectMerge",
          inputs: {
            user: "{{user.row}}",
            missing: "{{user.missing}}"
          }
        },
        runtimeState,
        runtimeContext
      ),
    (error: unknown) => {
      assert.ok(error instanceof MergeExecutorError);
      assert.equal(error.strategy, "objectMerge");
      assert.match(error.message, /Merge input "missing" resolved to undefined/);
      return true;
    }
  );
});

test("executeMergeNode supports custom hooks and resolves inputs first", async () => {
  const result = await executeMergeNode(
    {
      type: "merge",
      strategy: "custom",
      hook: "summarize",
      inputs: {
        user: "{{user.row}}",
        orders: "{{orders.row}}"
      }
    },
    runtimeState,
    runtimeContext,
    {
      hooks: {
        summarize(inputs, context) {
          assert.deepEqual(inputs, {
            user: { id: "user-1", name: "Ada" },
            orders: { id: "order-1", total: 42 }
          });
          assert.equal(context, runtimeContext);
          return {
            label: "custom-summary",
            count: Object.keys(inputs).length
          };
        }
      }
    }
  );

  assert.deepEqual(result, {
    label: "custom-summary",
    count: 2
  });
});

test("executeMergeNode fails clearly when custom hook is missing", async () => {
  await assert.rejects(
    () =>
      executeMergeNode(
        {
          type: "merge",
          strategy: "custom",
          hook: "unknown",
          inputs: {
            user: "{{user.row}}"
          }
        },
        runtimeState,
        runtimeContext,
        {
          hooks: {}
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof MergeExecutorError);
      assert.equal(error.strategy, "custom");
      assert.equal(error.hook, "unknown");
      assert.match(error.message, /Merge hook "unknown" is not registered/);
      return true;
    }
  );
});

test("executeMergeNode is immutable and arrayConcat rejects non-array inputs", async () => {
  const stateSnapshot = {
    user: { row: { id: "user-1", name: "Ada" } },
    orders: { row: { id: "order-1", total: 42 } }
  };
  const state: RuntimeStateStore = {
    get(path: string): unknown {
      return path.split(".").reduce<unknown>((current, segment) => {
        if (current && typeof current === "object") {
          return (current as Record<string, unknown>)[segment];
        }
        return undefined;
      }, stateSnapshot);
    }
  };
  const snapshot = structuredClone(stateSnapshot);

  await assert.rejects(
    () =>
      executeMergeNode(
        {
          type: "merge",
          strategy: "arrayConcat",
          inputs: {
            user: "{{user.row}}"
          }
        },
        state,
        runtimeContext
      ),
    (error: unknown) => {
      assert.ok(error instanceof MergeExecutorError);
      assert.match(error.message, /must resolve to an array/);
      return true;
    }
  );

  assert.deepEqual(stateSnapshot, snapshot);
});
