import test from "node:test";
import assert from "node:assert/strict";
import {
  executeMutationNode,
  executeSubmitPlan,
  type ExecutionNode,
  type ExecutionPlan,
  type MutationDatasourceAdapter,
  type NodeExecutorDependencies,
  type RuntimeContext,
  type RuntimeExecutorDependencies
} from "./runtime-test-api";
import type { MutationNodeDefinition } from "@zhongmiao/meta-lc-kernel";

const runtimeContext: RuntimeContext = {
  input: {
    tenantId: "tenant-a",
    orderId: "order-1",
    enableAudit: true,
    enableSkip: false
  },
  traceId: "trace-submit-1"
};

function createMutationAdapter() {
  const calls: Array<Parameters<MutationDatasourceAdapter["execute"]>[0]> = [];
  const adapter: MutationDatasourceAdapter = {
    async execute(command) {
      calls.push(command);
      switch (command.model) {
        case "prepare_model":
          return {
            rowCount: 1,
            row: { id: "prep-1" },
            beforeData: null,
            afterData: { id: "prep-1" }
          };
        case "orders":
          return {
            rowCount: 1,
            row: { id: "order-1", status: "PAID" },
            beforeData: null,
            afterData: { id: "order-1", status: "PAID" }
          };
        case "audit_logs":
          return {
            rowCount: 1,
            row: { id: "audit-1" },
            beforeData: null,
            afterData: { id: "audit-1", orderId: command.payload.orderId }
          };
        default:
          return {
            rowCount: 1,
            row: { id: "skip-1" },
            beforeData: null,
            afterData: { id: "skip-1" }
          };
      }
    }
  };

  return { adapter, calls };
}

function createRuntimeDeps(adapter: MutationDatasourceAdapter): RuntimeExecutorDependencies {
  return {
    executors: {
      query: async () => {
        throw new Error("query executor should not be called in submit tests.");
      },
      mutation: async (node, state, context) => executeMutationNode(node, state, context, { adapter }),
      merge: async () => {
        throw new Error("merge executor should not be called in submit tests.");
      },
      transform: async () => {
        throw new Error("transform executor should not be called in submit tests.");
      }
    } satisfies NodeExecutorDependencies
  };
}

function createPlan(): ExecutionPlan {
  const nodes: ExecutionNode[] = [
    createMutationNode("prepare", {
      model: "prepare_model",
      operation: "create",
      payload: {
        id: "{{input.orderId}}",
        traceId: "{{traceId}}"
      }
    }),
    createMutationNode("save_order", {
      model: "orders",
      operation: "create",
      payload: {
        id: "{{input.orderId}}",
        traceId: "{{traceId}}"
      }
    }),
    createMutationNode("audit_order", {
      model: "audit_logs",
      operation: "create",
      payload: {
        orderId: "{{save_order.afterData.id}}",
        status: "{{save_order.afterData.status}}"
      },
      condition: "{{input.enableAudit}}"
    }),
    createMutationNode("skip_order", {
      model: "skip_model",
      operation: "create",
      payload: {
        id: "{{input.orderId}}"
      },
      condition: "{{input.enableSkip}}"
    })
  ];

  return {
    nodes,
    edges: {
      audit_order: ["save_order"],
      prepare: [],
      save_order: [],
      skip_order: []
    },
    output: {
      prepareId: "{{prepare.afterData.id}}",
      savedId: "{{save_order.afterData.id}}",
      auditOrderId: "{{audit_order.afterData.id}}",
      skipped: "{{skip_order.skipped}}"
    },
    submit: {
      nodes: ["prepare", "save_order", "audit_order", "skip_order"]
    }
  };
}

function createMutationNode(id: string, definition: Omit<MutationNodeDefinition, "type">): ExecutionNode {
  return {
    id,
    type: "mutation",
    definition: {
      type: "mutation",
      ...definition
    }
  };
}

test("executeSubmitPlan runs submit nodes in stable order and returns mutation metadata", async () => {
  const { adapter, calls } = createMutationAdapter();
  const result = await executeSubmitPlan(createPlan(), runtimeContext, createRuntimeDeps(adapter));

  assert.deepEqual(
    calls.map((call) => call.model),
    ["prepare_model", "orders", "audit_logs"]
  );
  assert.deepEqual(result.submittedNodeIds, ["prepare", "save_order", "audit_order", "skip_order"]);
  assert.deepEqual(result.executedNodeIds, ["prepare", "save_order", "audit_order", "skip_order"]);
  assert.deepEqual(result.skippedNodeIds, ["skip_order"]);
  assert.equal(result.mutationResults.audit_order?.afterData?.orderId, "order-1");
  assert.deepEqual(result.viewModel, {
    prepareId: "prep-1",
    savedId: "order-1",
    auditOrderId: "audit-1",
    skipped: true
  });
});

test("executeSubmitPlan exposes previous mutation state to downstream payload mapping", async () => {
  const { adapter } = createMutationAdapter();
  const result = await executeSubmitPlan(
    {
      ...createPlan(),
      submit: {
        nodes: ["save_order", "audit_order"]
      },
      edges: {
        save_order: [],
        audit_order: ["save_order"]
      }
    },
    runtimeContext,
    createRuntimeDeps(adapter)
  );

  assert.equal(result.mutationResults.audit_order?.payload.orderId, "order-1");
  assert.equal(result.mutationResults.audit_order?.skipped, false);
  assert.deepEqual(result.executedNodeIds, ["save_order", "audit_order"]);
});
