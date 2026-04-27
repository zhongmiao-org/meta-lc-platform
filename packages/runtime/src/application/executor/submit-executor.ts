import type {
  ExecutionNode,
  ExecutionPlan,
  MutationExecutionResult,
  RuntimeExecutionResult,
  RuntimeExecutorDependencies,
  SubmitExecutionResult
} from "../../core/interfaces";
import type { RuntimeContext } from "../../core/types";
import { RuntimeExecutionError } from "../../core/errors";
import { RuntimeExecutor } from "./runtime-executor";

export async function executeSubmitPlan(
  plan: ExecutionPlan,
  context: RuntimeContext,
  deps: RuntimeExecutorDependencies
): Promise<SubmitExecutionResult> {
  const submitNodeIds = uniqueNodeIds(plan.submit?.nodes ?? []);
  if (submitNodeIds.length === 0) {
    const runtimeResult = await new RuntimeExecutor().execute(plan, context, deps);
    return {
      ...runtimeResult,
      submittedNodeIds: [],
      executedNodeIds: runtimeResult.layers.flat(),
      skippedNodeIds: [],
      mutationResults: {}
    };
  }

  const submitPlan = buildSubmitExecutionPlan(plan, submitNodeIds);
  const runtimeResult = await new RuntimeExecutor().execute(submitPlan, context, deps);
  const nodeById = new Map(submitPlan.nodes.map((node) => [node.id, node]));
  const executedNodeIds = runtimeResult.layers.flat();
  const mutationResults = collectMutationResults(runtimeResult, nodeById);
  const skippedNodeIds = Object.entries(mutationResults)
    .filter(([, result]) => result.skipped)
    .map(([nodeId]) => nodeId);

  return {
    ...runtimeResult,
    submittedNodeIds: submitNodeIds,
    executedNodeIds,
    skippedNodeIds,
    mutationResults
  };
}

export function buildSubmitExecutionPlan(plan: ExecutionPlan, submitNodeIds: string[]): ExecutionPlan {
  const nodeById = new Map(plan.nodes.map((node) => [node.id, node]));
  validateSubmitNodeIds(plan, submitNodeIds, nodeById);

  const reachable = collectDependencyClosure(plan.edges, submitNodeIds);
  const orderedNodes = plan.nodes.filter((node) => reachable.has(node.id));
  const baseEdges = filterEdges(plan.edges, reachable);
  const submitChainEdges = addSequentialSubmitEdges(baseEdges, submitNodeIds, reachable);

  return {
    nodes: orderedNodes,
    edges: submitChainEdges,
    output: plan.output,
    ...(plan.submit ? { submit: { ...plan.submit, nodes: [...submitNodeIds] } } : {})
  };
}

function validateSubmitNodeIds(
  plan: ExecutionPlan,
  submitNodeIds: string[],
  nodeById: Map<string, ExecutionNode>
): void {
  for (const nodeId of submitNodeIds) {
    if (!nodeById.has(nodeId)) {
      throw new RuntimeExecutionError(
        `SubmitDefinition references unknown node "${nodeId}".`,
        "schedule",
        undefined,
        nodeId
      );
    }
  }

  const submitNodeSet = new Set(submitNodeIds);
  for (const nodeId of submitNodeIds) {
    const deps = plan.edges[nodeId] ?? [];
    for (const dependency of deps) {
      if (!submitNodeSet.has(dependency) && !nodeById.has(dependency)) {
        throw new RuntimeExecutionError(
          `SubmitDefinition node "${nodeId}" depends on unknown node "${dependency}".`,
          "schedule",
          undefined,
          nodeId
        );
      }
    }
  }
}

function collectMutationResults(
  runtimeResult: RuntimeExecutionResult,
  nodeById: Map<string, ExecutionNode>
): Record<string, MutationExecutionResult> {
  const results: Record<string, MutationExecutionResult> = {};
  for (const [nodeId, nodeResult] of Object.entries(runtimeResult.nodeResults)) {
    const node = nodeById.get(nodeId);
    if (!node || node.type !== "mutation") {
      continue;
    }

    const value = nodeResult && typeof nodeResult === "object" && "value" in nodeResult ? nodeResult.value : nodeResult;
    if (isMutationExecutionResult(value)) {
      results[nodeId] = value;
    }
  }

  return results;
}

function isMutationExecutionResult(value: unknown): value is MutationExecutionResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "skipped" in value &&
    "model" in value &&
    "operation" in value &&
    "payload" in value &&
    "rowCount" in value &&
    "row" in value &&
    "beforeData" in value &&
    "afterData" in value &&
    "condition" in value
  );
}

function collectDependencyClosure(edges: ExecutionPlan["edges"], seedNodeIds: string[]): Set<string> {
  const reachable = new Set<string>();
  const queue = [...uniqueNodeIds(seedNodeIds)];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || reachable.has(nodeId)) {
      continue;
    }

    reachable.add(nodeId);
    for (const dependency of edges[nodeId] ?? []) {
      if (!reachable.has(dependency)) {
        queue.push(dependency);
      }
    }
  }

  return reachable;
}

function filterEdges(edges: ExecutionPlan["edges"], allowed: Set<string>): Record<string, string[]> {
  return Object.fromEntries(
    [...allowed]
      .sort((left, right) => left.localeCompare(right))
      .map((nodeId) => [nodeId, (edges[nodeId] ?? []).filter((dependency) => allowed.has(dependency))])
  );
}

function addSequentialSubmitEdges(
  edges: Record<string, string[]>,
  submitNodeIds: string[],
  allowed: Set<string>
): Record<string, string[]> {
  const nextEdges: Record<string, string[]> = Object.fromEntries(
    Object.entries(edges).map(([nodeId, dependencies]) => [nodeId, [...dependencies]])
  );

  const orderedSubmitNodeIds = uniqueNodeIds(submitNodeIds).filter((nodeId) => allowed.has(nodeId));
  for (let index = 1; index < orderedSubmitNodeIds.length; index += 1) {
    const currentNodeId = orderedSubmitNodeIds[index];
    const previousNodeId = orderedSubmitNodeIds[index - 1];
    const dependencies = nextEdges[currentNodeId] ?? [];
    if (!dependencies.includes(previousNodeId) && !hasPath(nextEdges, currentNodeId, previousNodeId)) {
      dependencies.push(previousNodeId);
      dependencies.sort((left, right) => left.localeCompare(right));
    }
    nextEdges[currentNodeId] = dependencies;
  }

  return nextEdges;
}

function uniqueNodeIds(nodeIds: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const nodeId of nodeIds) {
    if (seen.has(nodeId)) {
      continue;
    }
    seen.add(nodeId);
    unique.push(nodeId);
  }

  return unique;
}

function hasPath(edges: Record<string, string[]>, from: string, to: string): boolean {
  if (from === to) {
    return true;
  }

  const visited = new Set<string>();
  const queue = [...(edges[from] ?? [])];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) {
      continue;
    }
    if (nodeId === to) {
      return true;
    }
    visited.add(nodeId);
    queue.push(...(edges[nodeId] ?? []));
  }

  return false;
}
