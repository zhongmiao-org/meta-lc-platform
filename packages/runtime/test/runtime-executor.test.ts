import test from "node:test";
import assert from "node:assert/strict";
import {
  executeMergeNode,
  RuntimeExecutionError,
  RuntimeExecutor,
  type ExecutionNode,
  type ExecutionPlan,
  type NodeExecutorDependencies,
  type RuntimeContext
} from "../src";

const executor = new RuntimeExecutor();

const runtimeContext: RuntimeContext = {
  input: {
    tenantId: "tenant-a",
    userId: "user-1"
  },
  traceId: "trace-1"
};

function createExecutors(overrides: Partial<NodeExecutorDependencies> = {}): NodeExecutorDependencies {
  return {
    query: async () => {
      throw new Error("query executor should be overridden in this test.");
    },
    mutation: async () => {
      throw new Error("mutation executor should be overridden in this test.");
    },
    merge: async (node, state, context) => executeMergeNode(node as never, state, context),
    transform: async () => {
      throw new Error("transform executor should be overridden in this test.");
    },
    ...overrides
  };
}

function createQueryNode(id: string, table: string): ExecutionNode {
  return {
    id,
    type: "query",
    definition: {
      type: "query",
      table
    }
  };
}

function createMergeNode(id: string, inputs: Record<string, string>): ExecutionNode {
  return {
    id,
    type: "merge",
    definition: {
      type: "merge",
      strategy: "objectMerge",
      inputs
    }
  };
}

function createPlan(
  nodes: ExecutionNode[],
  edges: Record<string, string[]>,
  output: ExecutionPlan["output"]
): ExecutionPlan {
  return {
    nodes,
    edges,
    output
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("RuntimeExecutor executes a single query plan and resolves output against the final snapshot", async () => {
  const plan = createPlan(
    [createQueryNode("orders", "orders")],
    {
      orders: []
    },
    {
      rows: "{{orders.rows}}",
      firstOrderId: "{{orders.row.id}}",
      tenantId: "{{input.tenantId}}"
    }
  );

  const result = await executor.execute(plan, runtimeContext, {
    executors: createExecutors({
      query: async (node) => [
        {
          id: `${node.table}-1`,
          total: 42
        }
      ]
    })
  });

  assert.deepEqual(result.layers, [["orders"]]);
  assert.deepEqual(result.state, {
    orders: {
      rows: [
        {
          id: "orders-1",
          total: 42
        }
      ],
      row: {
        id: "orders-1",
        total: 42
      }
    }
  });
  assert.deepEqual(result.nodeResults.orders, {
    rows: [
      {
        id: "orders-1",
        total: 42
      }
    ],
    row: {
      id: "orders-1",
      total: 42
    }
  });
  assert.deepEqual(result.viewModel, {
    rows: [
      {
        id: "orders-1",
        total: 42
      }
    ],
    firstOrderId: "orders-1",
    tenantId: "tenant-a"
  });

  const snapshot = structuredClone(result);
  (result.state.orders as { row: { id: string } }).row.id = "mutated";
  assert.deepEqual(result.viewModel, snapshot.viewModel);
  assert.deepEqual(result.nodeResults, snapshot.nodeResults);
});

test("RuntimeExecutor commits a layer atomically when one sibling fails", async () => {
  const plan = createPlan(
    [createQueryNode("alpha", "alpha"), createQueryNode("zeta", "zeta")],
    {
      alpha: [],
      zeta: []
    },
    {
      alpha: "{{alpha.rows}}",
      zeta: "{{zeta.rows}}"
    }
  );

  await assert.rejects(
    () =>
      executor.execute(plan, runtimeContext, {
      executors: createExecutors({
        query: async (node, state) => {
          if (node.table === "alpha") {
            await delay(10);
            assert.equal(state.get("alpha"), undefined);
            return [{ id: "alpha-1" }];
          }

          if (node.table === "zeta") {
            await delay(20);
            assert.equal(state.get("alpha"), undefined);
            throw new Error("boom");
            }

            throw new Error(`Unexpected node "${node.id}".`);
          }
        })
      }),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeExecutionError);
      assert.equal(error.stage, "execute");
      assert.equal(error.nodeId, "zeta");
      assert.equal(error.nodeType, "query");
      assert.equal(error.cause instanceof Error ? error.cause.message : "", "boom");
      assert.match(error.message, /RuntimeExecutor failed for node "zeta" \(query\): boom/);
      return true;
    }
  );
});

test("RuntimeExecutor executes merge fan-in plans and preserves node envelopes", async () => {
  const plan = createPlan(
    [
      createQueryNode("user", "users"),
      createQueryNode("orders", "orders"),
      createMergeNode("summary", {
        user: "{{user.row}}",
        orders: "{{orders.rows}}"
      })
    ],
    {
      user: [],
      orders: [],
      summary: ["orders", "user"]
    },
    {
      summary: "{{summary.value}}",
      userName: "{{summary.value.user.name}}",
      orderCount: "{{summary.value.orders.length}}"
    }
  );

  const result = await executor.execute(plan, runtimeContext, {
    executors: createExecutors({
      query: async (node) => {
        if (node.table === "users") {
          return [
            {
              id: "user-1",
              name: "Ada"
            }
          ];
        }

        if (node.table === "orders") {
          return [
            {
              id: "order-1",
              total: 12
            },
            {
              id: "order-2",
              total: 34
            }
          ];
        }

        throw new Error(`Unexpected query node "${node.table}".`);
      }
    })
  });

  assert.deepEqual(result.layers, [["orders", "user"], ["summary"]]);
  assert.deepEqual(result.state.summary, {
    value: {
      user: {
        id: "user-1",
        name: "Ada"
      },
      orders: [
        {
          id: "order-1",
          total: 12
        },
        {
          id: "order-2",
          total: 34
        }
      ]
    }
  });
  assert.deepEqual(result.viewModel, {
    summary: {
      user: {
        id: "user-1",
        name: "Ada"
      },
      orders: [
        {
          id: "order-1",
          total: 12
        },
        {
          id: "order-2",
          total: 34
        }
      ]
    },
    userName: "Ada",
    orderCount: 2
  });
});

test("RuntimeExecutor handles empty plans against the provided context", async () => {
  const result = await executor.execute(
    {
      nodes: [],
      edges: {},
      output: {
        greeting: "hello {{input.userId}}",
        traceId: "{{traceId}}"
      }
    },
    runtimeContext,
    {
      executors: createExecutors()
    }
  );

  assert.deepEqual(result.layers, []);
  assert.deepEqual(result.state, {});
  assert.deepEqual(result.nodeResults, {});
  assert.deepEqual(result.viewModel, {
    greeting: "hello user-1",
    traceId: "trace-1"
  });
});
