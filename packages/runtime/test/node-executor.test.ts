import test from "node:test";
import assert from "node:assert/strict";
import {
  type ExecutionNode,
  executeNode,
  type NodeExecutorDependencies,
  NodeExecutorError,
  type RuntimeContext,
  type RuntimeStateStore
} from "./runtime-test-api";

function createNode(type: "query" | "mutation" | "merge" | "transform", definition: Record<string, unknown>) {
  return {
    id: `${type}-node`,
    type,
    definition: { type, ...definition }
  } as ExecutionNode;
}

function createExecutors(calls: string[], results: Record<string, unknown>): NodeExecutorDependencies {
  return {
    query: async (node, state, context) => {
      calls.push(`query:${node.type}`);
      assert.equal(state, runtimeState);
      assert.equal(context, runtimeContext);
      return results.query;
    },
    mutation: async (node, state, context) => {
      calls.push(`mutation:${node.type}`);
      assert.equal(state, runtimeState);
      assert.equal(context, runtimeContext);
      return results.mutation;
    },
    merge: async (node, state, context) => {
      calls.push(`merge:${node.type}`);
      assert.equal(state, runtimeState);
      assert.equal(context, runtimeContext);
      return results.merge;
    },
    transform: async (node, state, context) => {
      calls.push(`transform:${node.type}`);
      assert.equal(state, runtimeState);
      assert.equal(context, runtimeContext);
      return results.transform;
    }
  };
}

const runtimeState: RuntimeStateStore = {
  get(path: string): unknown {
    return path === "user.id" ? "user-1" : undefined;
  }
};

const runtimeContext: RuntimeContext = {
  requestId: "req-1"
};

test("executeNode dispatches query nodes", async () => {
  const calls: string[] = [];
  const result = await executeNode(
    createNode("query", { table: "users" }),
    runtimeState,
    runtimeContext,
    createExecutors(calls, { query: "query-result" })
  );

  assert.deepEqual(calls, ["query:query"]);
  assert.equal(result, "query-result");
});

test("executeNode dispatches mutation, merge, and transform nodes", async () => {
  const calls: string[] = [];
  const executors = createExecutors(calls, {
    query: "query-result",
    mutation: "mutation-result",
    merge: "merge-result",
    transform: "transform-result"
  });

  assert.equal(await executeNode(createNode("mutation", { model: "users" }), runtimeState, runtimeContext, executors), "mutation-result");
  assert.equal(await executeNode(createNode("merge", { strategy: "objectMerge" }), runtimeState, runtimeContext, executors), "merge-result");
  assert.equal(await executeNode(createNode("transform", { mapper: true }), runtimeState, runtimeContext, executors), "transform-result");
  assert.deepEqual(calls, ["mutation:mutation", "merge:merge", "transform:transform"]);
});

test("executeNode rejects unsupported node types with a clear error", async () => {
  await assert.rejects(
    () =>
      executeNode(
        {
          id: "broken-node",
          type: "other",
          definition: { type: "other" }
        } as never,
        runtimeState,
        runtimeContext,
        createExecutors([], {})
      ),
    (error: unknown) => {
      assert.ok(error instanceof NodeExecutorError);
      assert.equal(error.message, 'Unsupported node type "other".');
      return true;
    }
  );
});

test("executeNode rejects missing executors with a clear error", async () => {
  const partialExecutors = {
    query: undefined,
    mutation: undefined,
    merge: undefined,
    transform: undefined
  } as unknown as NodeExecutorDependencies;

  await assert.rejects(
    () => executeNode(createNode("query", { table: "users" }), runtimeState, runtimeContext, partialExecutors),
    (error: unknown) => {
      assert.ok(error instanceof NodeExecutorError);
      assert.equal(error.message, 'Missing node executor for "query".');
      return true;
    }
  );
});

test("executeNode preserves input references and propagates executor errors", async () => {
  const state = Object.freeze(runtimeState);
  const context = Object.freeze(runtimeContext);

  await assert.rejects(
    () =>
      executeNode(
        createNode("query", { table: "users" }),
        state,
        context,
        {
          query: async () => {
            throw new Error("query failed");
          },
          mutation: async () => "mutation-result",
          merge: async () => "merge-result",
          transform: async () => "transform-result"
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "query failed");
      return true;
    }
  );
});
