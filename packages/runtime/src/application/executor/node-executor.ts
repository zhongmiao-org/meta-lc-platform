import {
  type ExecutionNode,
  type RuntimeContext,
  type RuntimeStateStore,
  NodeExecutorError
} from "../../types";
import type {
  MergeNodeDefinition,
  MutationNodeDefinition,
  NodeDefinition,
  QueryNodeDefinition,
  TransformNodeDefinition
} from "@zhongmiao/meta-lc-kernel";

export type NodeExecutionResult = unknown;

export interface NodeExecutionMetadata {
  nodeId: string;
  nodeType: ExecutionNode["type"];
}

export type NodeTypeExecutor<TNode extends NodeDefinition = NodeDefinition> = (
  node: TNode,
  state: RuntimeStateStore,
  context: RuntimeContext,
  metadata?: NodeExecutionMetadata
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
      return runExecutor("query", executors.query, node.definition as QueryNodeDefinition, state, context, {
        nodeId: node.id,
        nodeType: node.type
      });
    case "mutation":
      return runExecutor("mutation", executors.mutation, node.definition as MutationNodeDefinition, state, context, {
        nodeId: node.id,
        nodeType: node.type
      });
    case "merge":
      return runExecutor("merge", executors.merge, node.definition as MergeNodeDefinition, state, context, {
        nodeId: node.id,
        nodeType: node.type
      });
    case "transform":
      return runExecutor("transform", executors.transform, node.definition as TransformNodeDefinition, state, context, {
        nodeId: node.id,
        nodeType: node.type
      });
    default:
      throw new NodeExecutorError(`Unsupported node type "${String(node.type)}".`);
  }
}

async function runExecutor<TNode extends NodeDefinition>(
  kind: NodeDefinition["type"],
  executor: NodeTypeExecutor<TNode> | undefined,
  node: TNode,
  state: RuntimeStateStore,
  context: RuntimeContext,
  metadata: NodeExecutionMetadata
): Promise<NodeExecutionResult> {
  if (typeof executor !== "function") {
    throw new NodeExecutorError(`Missing node executor for "${kind}".`);
  }

  return executor(node, state, context, metadata);
}
