import type {
  MergeNodeDefinition,
  MutationNodeDefinition,
  QueryNodeDefinition,
  TransformNodeDefinition
} from "@zhongmiao/meta-lc-kernel";
import type {
  ExecutionNode
} from "./runtime.interface";
import type {
  NodeTypeExecutor
} from "../types";

export interface NodeExecutionMetadata {
  nodeId: string;
  nodeType: ExecutionNode["type"];
}

export interface NodeExecutorDependencies {
  query: NodeTypeExecutor<QueryNodeDefinition>;
  mutation: NodeTypeExecutor<MutationNodeDefinition>;
  merge: NodeTypeExecutor<MergeNodeDefinition>;
  transform: NodeTypeExecutor<TransformNodeDefinition>;
}
