import type {
  BuildExecutionPlanRequest,
  ExecutionNode,
  ExecutionPlan,
  ViewCompilerDependency
} from "../../core/interfaces";
import { ViewCompilerError } from "../../core/errors";
import type { NodeDefinition, OutputDefinition, SubmitDefinition } from "@zhongmiao/meta-lc-kernel";

const EXPRESSION_PATTERN = /\{\{\s*([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\s*\}\}/g;
const RUNTIME_CONTEXT_ROOTS = new Set(["input", "params", "user", "ctx", "context", "state"]);
const SUPPORTED_NODE_TYPES = new Set(["query", "mutation", "transform", "merge"]);

export function buildExecutionPlan(request: BuildExecutionPlanRequest): ExecutionPlan {
  const nodeIds = Object.keys(request.nodes).sort((left, right) => left.localeCompare(right));
  const knownNodeIds = new Set(nodeIds);
  const nodes = nodeIds.map<ExecutionNode>((nodeId) => createExecutionNode(nodeId, request.nodes[nodeId]));
  collectExpressionDependencies(request.output, knownNodeIds, "output");
  validateSubmitDefinition(request.submit, knownNodeIds);
  const edges = Object.fromEntries(
    nodeIds.map((nodeId) => [
      nodeId,
      collectNodeDependencies(request.nodes[nodeId], knownNodeIds, `nodes.${nodeId}`)
    ])
  );

  return {
    nodes,
    edges,
    output: request.output,
    ...(request.submit ? { submit: request.submit } : {})
  };
}

export function collectExpressionDependencies(
  value: unknown,
  knownNodeIds: ReadonlySet<string>,
  path = "value"
): ViewCompilerDependency[] {
  const dependencies = new Map<string, ViewCompilerDependency>();

  visitExpressionValue(value, (template) => {
    for (const match of template.matchAll(EXPRESSION_PATTERN)) {
      const expression = match[1];
      const root = expression?.split(".")[0];
      if (!expression || !root) {
        continue;
      }
      if (knownNodeIds.has(root)) {
        dependencies.set(root, { nodeId: root, expression: match[0] });
        continue;
      }
      if (RUNTIME_CONTEXT_ROOTS.has(root)) {
        continue;
      }
      throw new ViewCompilerError(`Unknown node dependency "${root}" referenced by expression "${match[0]}" at ${path}.`);
    }
  });

  return [...dependencies.values()].sort((left, right) => left.nodeId.localeCompare(right.nodeId));
}

function createExecutionNode(id: string, definition: NodeDefinition | undefined): ExecutionNode {
  if (!definition) {
    throw new ViewCompilerError(`Missing node definition for "${id}".`);
  }
  if (!SUPPORTED_NODE_TYPES.has(definition.type)) {
    throw new ViewCompilerError(`Unsupported node type "${definition.type}" for node "${id}".`);
  }
  return {
    id,
    type: definition.type,
    definition
  };
}

function collectNodeDependencies(
  definition: NodeDefinition | undefined,
  knownNodeIds: ReadonlySet<string>,
  path: string
): string[] {
  if (!definition) {
    return [];
  }
  return collectExpressionDependencies(definition, knownNodeIds, path).map((dependency) => dependency.nodeId);
}

function validateSubmitDefinition(submit: SubmitDefinition | undefined, knownNodeIds: ReadonlySet<string>): void {
  submit?.nodes?.forEach((nodeId) => {
    if (!knownNodeIds.has(nodeId)) {
      throw new ViewCompilerError(`SubmitDefinition references unknown node "${nodeId}".`);
    }
  });
}

function visitExpressionValue(value: unknown, onString: (template: string) => void): void {
  if (typeof value === "string") {
    onString(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => visitExpressionValue(item, onString));
    return;
  }
  if (isPlainObject(value)) {
    Object.values(value).forEach((item) => visitExpressionValue(item, onString));
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
