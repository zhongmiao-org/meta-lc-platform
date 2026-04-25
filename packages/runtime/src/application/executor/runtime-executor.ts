import type { QueryResultRow } from "@zhongmiao/meta-lc-datasource";
import { resolveExpression } from "../../domain/dsl/expression";
import { parseRuntimePageDsl } from "../../domain/dsl/runtime-dsl-parser";
import { resolveExecutionOrder } from "../../domain/graph/dep-resolver";
import { buildDependencyGraph, planRefresh } from "../../domain/graph/runtime-dependency-graph";
import { createFunctionRegistry } from "../function-registry";
import { evaluateRules } from "../rule-engine";
import { executeNode, type NodeExecutorDependencies } from "./node-executor";
import {
  createRuntimeAuditDispatchContext,
  emitRuntimeAuditEvent,
  getErrorMessage,
  type RuntimeAuditDispatchContext
} from "./runtime-audit";
import {
  type ExecutionNode,
  type ExecutionPlan,
  RuntimeExecutionError,
  type RuntimeExecutionResult,
  type RuntimeExecutionStage,
  type RuntimeNodeResult,
  type RuntimeQueryNodeResult,
  type RuntimeStateStore,
  type RuntimeValueNodeResult,
  type RuntimeContext,
  buildRuntimePageTopic,
  type ParsedRuntimePageDsl,
  type RuntimeFunctionRegistry,
  type RuntimePageDsl,
  type RuntimePageTopicRef,
  type RuntimeRefreshEvent,
  type RuntimeRefreshPlan,
  type RuntimeRuleEffectsPlan
} from "../../types";
import type { RuntimeAuditObserver } from "@zhongmiao/meta-lc-audit";

export interface RuntimeExecutorDependencies {
  executors: NodeExecutorDependencies;
  auditObserver?: RuntimeAuditObserver;
}

export type RuntimeManagerCommand =
  | {
      type: "patchState";
      patch: Record<string, unknown>;
    }
  | {
      type: "refreshDatasource";
      datasourceId: string;
    }
  | {
      type: "runAction";
      actionId: string;
    };

export interface RuntimeManagerEventRequest {
  dsl: RuntimePageDsl | ParsedRuntimePageDsl;
  state: Record<string, unknown>;
  event: RuntimeRefreshEvent;
  functionRegistry?: RuntimeFunctionRegistry;
  pageInstance?: RuntimePageTopicRef;
}

export interface RuntimeManagerPlan {
  refreshPlan: RuntimeRefreshPlan;
  ruleEffects: RuntimeRuleEffectsPlan;
  nextState: Record<string, unknown>;
  managerCommands: RuntimeManagerCommand[];
  wsTopics: string[];
}

export class RuntimeExecutor {
  async execute(
    plan: ExecutionPlan,
    context: RuntimeContext,
    deps: RuntimeExecutorDependencies
  ): Promise<RuntimeExecutionResult> {
    const auditContext = createRuntimeAuditDispatchContext(context, deps.auditObserver, plan);
    const startedAt = Date.now();
    emitRuntimeAuditEvent(auditContext, {
      type: "runtime.plan.started",
      status: "started",
      metadata: {
        nodeCount: plan.nodes.length
      }
    });

    try {
      const result = await this.executeInternal(plan, context, deps, auditContext);
      emitRuntimeAuditEvent(auditContext, {
        type: "runtime.plan.finished",
        status: "success",
        durationMs: Date.now() - startedAt,
        metadata: {
          layerCount: result.layers.length,
          nodeCount: plan.nodes.length
        }
      });
      return result;
    } catch (error) {
      emitRuntimeAuditEvent(auditContext, {
        type: "runtime.plan.finished",
        status: "failure",
        durationMs: Date.now() - startedAt,
        errorMessage: getErrorMessage(error),
        metadata: {
          nodeCount: plan.nodes.length
        }
      });
      throw error;
    }
  }

  async planManagerEvent(request: RuntimeManagerEventRequest): Promise<RuntimeManagerPlan> {
    const parsedDsl = isParsedRuntimePageDsl(request.dsl) ? request.dsl : parseRuntimePageDsl(request.dsl);
    const graph = buildDependencyGraph(parsedDsl);
    const refreshPlan = planRefresh(graph, request.event);
    const functionRegistry = request.functionRegistry ?? createFunctionRegistry();
    const ruleEffects = await evaluateRules({
      event: request.event,
      state: request.state,
      parsedDsl,
      graph,
      functionRegistry
    });
    const nextState = {
      ...request.state,
      ...ruleEffects.patchState
    };

    return {
      refreshPlan,
      ruleEffects,
      nextState,
      managerCommands: buildManagerCommands(refreshPlan, ruleEffects),
      wsTopics: request.pageInstance ? [buildRuntimePageTopic(request.pageInstance)] : []
    };
  }

  private async executeInternal(
    plan: ExecutionPlan,
    context: RuntimeContext,
    deps: RuntimeExecutorDependencies,
    auditContext: RuntimeAuditDispatchContext
  ): Promise<RuntimeExecutionResult> {
    const nodeById = buildNodeLookup(plan.nodes);
    validatePlanCoverage(plan, nodeById);

    let layers: string[][];
    try {
      layers = resolveExecutionOrder(plan.edges);
    } catch (error) {
      throw wrapRuntimeExecutionError("schedule", error);
    }

    let currentState: Record<string, unknown> = {};
    const nodeResults: Record<string, RuntimeNodeResult> = {};
    const executedLayers: string[][] = [];

    for (const layer of layers) {
      const layerSnapshot = cloneValue(currentState);
      const layerState = createRuntimeStateStore(layerSnapshot);
      const layerResults = await Promise.all(
        layer.map(async (nodeId) => {
          const node = nodeById.get(nodeId);
          if (!node) {
            throw new RuntimeExecutionError(
              `Execution plan references unknown node "${nodeId}".`,
              "schedule",
              undefined,
              nodeId
            );
          }

          const nodeStartedAt = Date.now();
          try {
            const result = await executeNode(node, layerState, context, deps.executors);
            const normalized = normalizeNodeResult(node, result, nodeId);
            emitRuntimeAuditEvent(auditContext, {
              type: "runtime.node.succeeded",
              status: "success",
              nodeId,
              nodeType: node.type,
              durationMs: Date.now() - nodeStartedAt
            });
            return {
              node,
              nodeId,
              result: normalized
            };
          } catch (error) {
            emitRuntimeAuditEvent(auditContext, {
              type: "runtime.node.failed",
              status: "failure",
              nodeId,
              nodeType: node.type,
              durationMs: Date.now() - nodeStartedAt,
              errorMessage: getErrorMessage(error)
            });
            throw wrapRuntimeExecutionError("execute", error, node);
          }
        })
      );

      const committedLayerResults: Record<string, RuntimeNodeResult> = {};
      for (const { nodeId, result } of layerResults) {
        const normalized = result;
        committedLayerResults[nodeId] = cloneValue(normalized);
        nodeResults[nodeId] = cloneValue(normalized);
      }

      currentState = {
        ...currentState,
        ...committedLayerResults
      };
      executedLayers.push([...layer]);
    }

    let viewModel: Record<string, unknown>;
    try {
      viewModel = resolveExpression(plan.output, createRuntimeExpressionStateSource(currentState, context)) as Record<
        string,
        unknown
      >;
    } catch (error) {
      throw wrapRuntimeExecutionError("output", error);
    }

    return {
      viewModel: cloneValue(viewModel),
      state: cloneValue(currentState),
      nodeResults: cloneValue(nodeResults),
      layers: executedLayers.map((layer) => [...layer])
    };
  }
}

export function planRuntimeManagerEvent(request: RuntimeManagerEventRequest): Promise<RuntimeManagerPlan> {
  return new RuntimeExecutor().planManagerEvent(request);
}

function buildNodeLookup(nodes: ExecutionPlan["nodes"]): Map<string, ExecutionNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function validatePlanCoverage(plan: ExecutionPlan, nodeById: Map<string, ExecutionNode>): void {
  for (const node of plan.nodes) {
    if (!Object.prototype.hasOwnProperty.call(plan.edges, node.id)) {
      throw new RuntimeExecutionError(
        `Execution plan is missing dependencies for node "${node.id}".`,
        "schedule",
        undefined,
        node.id,
        node.type
      );
    }
  }

  for (const nodeId of Object.keys(plan.edges)) {
    if (!nodeById.has(nodeId)) {
      throw new RuntimeExecutionError(
        `Execution plan references unknown node "${nodeId}" in edges.`,
        "schedule",
        undefined,
        nodeId
      );
    }
  }
}

function buildManagerCommands(
  refreshPlan: RuntimeRefreshPlan,
  ruleEffects: RuntimeRuleEffectsPlan
): RuntimeManagerCommand[] {
  const commands: RuntimeManagerCommand[] = [];
  if (Object.keys(ruleEffects.patchState).length > 0) {
    commands.push({
      type: "patchState",
      patch: ruleEffects.patchState
    });
  }

  for (const datasourceId of mergeStableIds(refreshPlan.datasourceIds, ruleEffects.refreshDatasourceIds)) {
    commands.push({
      type: "refreshDatasource",
      datasourceId
    });
  }

  for (const actionId of mergeStableIds(refreshPlan.actionIds, ruleEffects.runActionIds)) {
    commands.push({
      type: "runAction",
      actionId
    });
  }
  return commands;
}

function mergeStableIds(primary: string[], secondary: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const append = (id: string): void => {
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    result.push(id);
  };

  primary.forEach(append);
  [...secondary].sort((left, right) => left.localeCompare(right)).forEach(append);
  return result;
}

function isParsedRuntimePageDsl(value: RuntimePageDsl | ParsedRuntimePageDsl): value is ParsedRuntimePageDsl {
  return "stateKeys" in value && "dependencies" in value;
}

function normalizeNodeResult(
  node: ExecutionNode,
  result: unknown,
  nodeId: string
): RuntimeNodeResult {
  switch (node.type) {
    case "query":
      return normalizeQueryNodeResult(result, nodeId);
    case "mutation":
    case "merge":
    case "transform":
      return {
        value: result
      } satisfies RuntimeValueNodeResult;
    default:
      const unsupportedType = (node as { type: string }).type as ExecutionNode["type"];
      throw new RuntimeExecutionError(
        `Unsupported node type "${String(unsupportedType)}" in execution result normalization.`,
        "execute",
        undefined,
        nodeId,
        unsupportedType
      );
  }
}

function normalizeQueryNodeResult(result: unknown, nodeId: string): RuntimeQueryNodeResult {
  if (Array.isArray(result)) {
    return {
      rows: result as QueryResultRow[],
      row: (result[0] as QueryResultRow | undefined) ?? null
    };
  }

  if (isPlainObject(result) && Array.isArray(result.rows)) {
    const rows = result.rows as QueryResultRow[];
    return {
      rows,
      row: (result.row as QueryResultRow | null | undefined) ?? (rows[0] ?? null)
    };
  }

  throw new RuntimeExecutionError(
    `Query node "${nodeId}" returned an invalid result shape.`,
    "execute",
    result,
    nodeId,
    "query"
  );
}

function createRuntimeStateStore(snapshot: Record<string, unknown>): RuntimeStateStore {
  return {
    get(path: string): unknown {
      if (!path.trim()) {
        return undefined;
      }

      return getNestedValueWithValueFallback(snapshot, path);
    }
  };
}

function createRuntimeExpressionStateSource(
  snapshot: Record<string, unknown>,
  context: RuntimeContext
): RuntimeStateStore {
  return {
    get(path: string): unknown {
      if (!path.trim()) {
        return undefined;
      }

      const stateValue = getNestedValueWithValueFallback(snapshot, path);
      if (stateValue !== undefined) {
        return stateValue;
      }

      return getNestedValueWithValueFallback(context, path);
    }
  };
}

function getNestedValueWithValueFallback(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isRecordLike(current)) {
      return undefined;
    }

    if (segment in current) {
      return current[segment];
    }

    const wrappedValue = current.value;
    if (isRecordLike(wrappedValue) && segment in wrappedValue) {
      return wrappedValue[segment];
    }

    return undefined;
  }, source);
}

function wrapRuntimeExecutionError(
  stage: RuntimeExecutionStage,
  error: unknown,
  node?: ExecutionNode
): RuntimeExecutionError {
  if (error instanceof RuntimeExecutionError) {
    return error;
  }

  const message =
    node && stage === "execute"
      ? `RuntimeExecutor failed for node "${node.id}" (${node.type}): ${getErrorMessage(error)}`
      : stage === "output"
        ? `RuntimeExecutor failed while resolving output: ${getErrorMessage(error)}`
        : `RuntimeExecutor failed while scheduling execution plan: ${getErrorMessage(error)}`;

  return new RuntimeExecutionError(
    message,
    stage,
    error,
    node?.id,
    node?.type
  );
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
