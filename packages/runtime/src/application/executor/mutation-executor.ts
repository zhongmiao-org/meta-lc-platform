import { resolveExpression } from "../../domain/dsl/expression";
import type {
  MutationAdapterCommand,
  MutationAdapterResult,
  MutationExecutionResult,
  RuntimeStateStore
} from "../../core/interfaces";
import type { RuntimeContext } from "../../core/types";
import type { MutationNodeDefinition } from "@zhongmiao/meta-lc-kernel";
import { NodeExecutorError } from "../../core/errors";
import type { MutationDatasourceAdapter } from "../../infra/adapters/mutation.adapter";

export interface MutationExecutorDependencies {
  adapter: MutationDatasourceAdapter;
}

export async function executeMutationNode(
  node: MutationNodeDefinition,
  state: RuntimeStateStore,
  context: RuntimeContext,
  dependencies: MutationExecutorDependencies
): Promise<MutationExecutionResult> {
  const resolvedNode = resolveExpression(node as never, new MutationExpressionStateSource(state, context)) as ResolvedMutationNodeDefinition;
  const model = readRequiredString(resolvedNode.model, "model");
  const operation = readMutationOperation(resolvedNode.operation);
  const payload = readPayload(resolvedNode.payload);
  const condition = resolveCondition(resolvedNode.condition);

  if (condition !== null && !condition) {
    return {
      skipped: true,
      model,
      operation,
      payload,
      rowCount: 0,
      row: null,
      beforeData: null,
      afterData: null,
      condition
    };
  }

  const command: MutationAdapterCommand = {
    model,
    operation,
    payload,
    context
  };

  try {
    const result = await dependencies.adapter.execute(command);
    return normalizeMutationResult(model, operation, payload, condition, result);
  } catch (error) {
    throw new NodeExecutorError(
      `Failed to execute mutation node for model "${model}" with operation "${operation}": ${getErrorMessage(error)}`,
    );
  }
}

function normalizeMutationResult(
  model: string,
  operation: MutationAdapterCommand["operation"],
  payload: Record<string, unknown>,
  condition: boolean | null,
  result: MutationAdapterResult
): MutationExecutionResult {
  return {
    skipped: false,
    model,
    operation,
    payload,
    rowCount: result.rowCount,
    row: result.row,
    beforeData: result.beforeData,
    afterData: result.afterData,
    condition
  };
}

function resolveCondition(value: unknown): boolean | null {
  if (value === undefined || value === null) {
    return null;
  }

  return Boolean(value);
}

function readPayload(value: unknown): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }

  if (!isPlainObject(value)) {
    throw new NodeExecutorError('Mutation node "payload" must resolve to an object.');
  }

  return value;
}

function readRequiredString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new NodeExecutorError(`Mutation node is missing a valid "${key}" value.`);
  }

  return value.trim();
}

function readMutationOperation(value: unknown): MutationAdapterCommand["operation"] {
  if (value === "create" || value === "update" || value === "delete") {
    return value;
  }

  throw new NodeExecutorError(
    'Mutation node is missing a valid "operation" value. Expected "create", "update", or "delete".',
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class MutationExpressionStateSource {
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

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

interface ResolvedMutationNodeDefinition {
  model?: unknown;
  operation?: unknown;
  payload?: unknown;
  condition?: unknown;
}
