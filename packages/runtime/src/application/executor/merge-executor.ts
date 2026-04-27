import { resolveExpression } from "../../domain/dsl/expression";
import {
  MergeExecutorError,
  type RuntimeContext,
  type RuntimeStateStore
} from "../../core/types";
import type { MergeNodeDefinition, MergeStrategy } from "@zhongmiao/meta-lc-kernel";

export type MergeExecutorResult = unknown;

export type MergeExecutorHook = (
  inputs: Record<string, unknown>,
  context: RuntimeContext
) => MergeExecutorResult | Promise<MergeExecutorResult>;

export interface MergeExecutorDependencies {
  hooks?: Record<string, MergeExecutorHook>;
}

export async function executeMergeNode(
  node: MergeNodeDefinition,
  state: RuntimeStateStore,
  context: RuntimeContext,
  dependencies: MergeExecutorDependencies = {}
): Promise<MergeExecutorResult> {
  const strategy = node.strategy ?? "objectMerge";
  const inputs = resolveMergeInputs(node.inputs, state, strategy, context);

  switch (strategy) {
    case "objectMerge":
      return mergeObjectInputs(inputs);
    case "arrayConcat":
      return mergeArrayInputs(inputs, strategy);
    case "custom":
      return executeCustomMerge(node, inputs, context, dependencies);
    default:
      throw new MergeExecutorError(`Unsupported merge strategy "${String(strategy)}".`, strategy);
  }
}

function resolveMergeInputs(
  inputs: MergeNodeDefinition["inputs"],
  state: RuntimeStateStore,
  strategy: MergeStrategy,
  context: RuntimeContext
): Record<string, unknown> {
  if (!inputs || Object.keys(inputs).length === 0) {
    throw new MergeExecutorError(`Merge node requires a non-empty inputs object for "${strategy}".`, strategy);
  }

  const resolved: Record<string, unknown> = {};
  const expressionStateSource = new MergeExpressionStateSource(state, context);

  for (const [key, expression] of Object.entries(inputs)) {
    const value = resolveExpression(expression, expressionStateSource);
    if (value === undefined) {
      throw new MergeExecutorError(`Merge input "${key}" resolved to undefined.`, strategy);
    }
    resolved[key] = value;
  }

  return resolved;
}

function mergeObjectInputs(inputs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(inputs));
}

function mergeArrayInputs(inputs: Record<string, unknown>, strategy: MergeStrategy): unknown[] {
  const result: unknown[] = [];

  for (const [key, value] of Object.entries(inputs)) {
    if (!Array.isArray(value)) {
      throw new MergeExecutorError(`Merge input "${key}" must resolve to an array for "${strategy}".`, strategy);
    }
    result.push(...value);
  }

  return result;
}

async function executeCustomMerge(
  node: MergeNodeDefinition,
  inputs: Record<string, unknown>,
  context: RuntimeContext,
  dependencies: MergeExecutorDependencies
): Promise<MergeExecutorResult> {
  const hookName = node.hook?.trim();
  if (!hookName) {
    throw new MergeExecutorError('Merge node strategy "custom" requires a hook name.', "custom");
  }

  const hook = dependencies.hooks?.[hookName];
  if (typeof hook !== "function") {
    throw new MergeExecutorError(`Merge hook "${hookName}" is not registered.`, "custom", hookName);
  }

  try {
    return await hook(inputs, context);
  } catch (error) {
    throw new MergeExecutorError(
      `Merge hook "${hookName}" failed: ${getErrorMessage(error)}`,
      "custom",
      hookName
    );
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class MergeExpressionStateSource {
  constructor(
    private readonly state: RuntimeStateStore,
    private readonly context: RuntimeContext
  ) {}

  get(path: string): unknown {
    if (!path.trim()) {
      return undefined;
    }

    const stateValue = this.state.get(path);
    if (stateValue !== undefined) {
      return stateValue;
    }

    return getNestedValue(this.context, path);
  }
}

function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isRecordLike(current)) {
      return undefined;
    }
    return current[segment];
  }, source);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
