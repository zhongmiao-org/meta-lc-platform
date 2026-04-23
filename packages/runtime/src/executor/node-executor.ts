import {
  type ExecutionNode,
  type MergeNodeDefinition,
  type MutationNodeDefinition,
  type NodeDefinition,
  type QueryNodeDefinition,
  type RuntimeContext,
  type RuntimeStateStore,
  type TransformNodeDefinition,
  NodeExecutorError
} from "../types";

export type NodeExecutionResult = unknown;

export type NodeTypeExecutor<TNode extends NodeDefinition = NodeDefinition> = (
  node: TNode,
  state: RuntimeStateStore,
  context: RuntimeContext
) => NodeExecutionResult | Promise<NodeExecutionResult>;

export interface NodeExecutorDependencies {
  query: NodeTypeExecutor<QueryNodeDefinition>;
  mutation: NodeTypeExecutor<MutationNodeDefinition>;
  merge: NodeTypeExecutor<MergeNodeDefinition>;
  transform: NodeTypeExecutor<TransformNodeDefinition>;
}

export async function executeNode(
  node: ExecutionNode,
  state: RuntimeStateStore,
  context: RuntimeContext,
  executors: NodeExecutorDependencies
): Promise<NodeExecutionResult> {
  switch (node.type) {
    case "query":
      return runExecutor("query", executors.query, node.definition as QueryNodeDefinition, state, context);
    case "mutation":
      return runExecutor("mutation", executors.mutation, node.definition as MutationNodeDefinition, state, context);
    case "merge":
      return runExecutor("merge", executors.merge, node.definition as MergeNodeDefinition, state, context);
    case "transform":
      return runExecutor("transform", executors.transform, node.definition as TransformNodeDefinition, state, context);
    default:
      throw new NodeExecutorError(`Unsupported node type "${String(node.type)}".`);
  }
}

async function runExecutor<TNode extends NodeDefinition>(
  kind: NodeDefinition["type"],
  executor: NodeTypeExecutor<TNode> | undefined,
  node: TNode,
  state: RuntimeStateStore,
  context: RuntimeContext
): Promise<NodeExecutionResult> {
  if (typeof executor !== "function") {
    throw new NodeExecutorError(`Missing node executor for "${kind}".`);
  }

  return executor(node, state, context);
}
