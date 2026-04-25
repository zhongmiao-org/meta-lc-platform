import { resolveExpression } from "../../domain/dsl/expression";
import {
  type MergeExecutorDependencies,
  executeMergeNode
} from "./merge-executor";
import { executeMutationNode } from "./mutation-executor";
import { executeQueryNode } from "./query-executor";
import type { RuntimeExecutorDependencies } from "./runtime-executor";
import type { RuntimeAuditObserver } from "@zhongmiao/meta-lc-audit";
import { executeSubmitPlan, type SubmitExecutionResult } from "./submit-executor";
import type {
  RuntimeContext,
  RuntimeStateStore
} from "../../types";
import type { TransformNodeDefinition, ViewDefinition } from "@zhongmiao/meta-lc-kernel";
import type {
  QueryCompilerAdapter,
  QueryDatasourceAdapter,
  QueryPermissionAdapter
} from "../../infra/adapter/query.adapter";
import type { MutationDatasourceAdapter } from "../../infra/adapter/mutation.adapter";
import { compileViewDefinition } from "../compiler/view-compiler";

export interface RuntimeViewExecutorDependencies {
  queryCompiler?: QueryCompilerAdapter;
  queryPermission?: QueryPermissionAdapter;
  queryDatasource: QueryDatasourceAdapter;
  mutationDatasource: MutationDatasourceAdapter;
  merge?: MergeExecutorDependencies;
  auditObserver?: RuntimeAuditObserver;
}

export async function executeRuntimeView(
  view: ViewDefinition,
  context: RuntimeContext,
  dependencies: RuntimeViewExecutorDependencies
): Promise<SubmitExecutionResult> {
  const plan = compileViewDefinition(view);
  return executeSubmitPlan(plan, context, {
    executors: createRuntimeViewExecutors(dependencies),
    ...(dependencies.auditObserver ? { auditObserver: dependencies.auditObserver } : {})
  });
}

function createRuntimeViewExecutors(
  dependencies: RuntimeViewExecutorDependencies
): RuntimeExecutorDependencies["executors"] {
  return {
    query: (node, state, context, metadata) =>
      executeQueryNode(node, state, context, {
        ...(dependencies.queryCompiler ? { compiler: dependencies.queryCompiler } : {}),
        ...(dependencies.queryPermission ? { permission: dependencies.queryPermission } : {}),
        datasource: dependencies.queryDatasource,
        ...(dependencies.auditObserver
          ? {
              audit: {
                observer: dependencies.auditObserver,
                nodeId: metadata?.nodeId,
                nodeType: metadata?.nodeType
              }
            }
          : {})
      }),
    mutation: (node, state, context) =>
      executeMutationNode(node, state, context, {
        adapter: dependencies.mutationDatasource
      }),
    merge: (node, state, context) => executeMergeNode(node, state, context, dependencies.merge),
    transform: (node, state, context) => executeTransformNode(node, state, context)
  };
}

function executeTransformNode(
  node: TransformNodeDefinition,
  state: RuntimeStateStore,
  context: RuntimeContext
): unknown {
  return resolveExpression(node as never, createExpressionStateSource(state, context));
}

function createExpressionStateSource(state: RuntimeStateStore, context: RuntimeContext) {
  return {
    get(path: string): unknown {
      if (!path.trim()) {
        return undefined;
      }

      const stateValue = state.get(path);
      if (stateValue !== undefined) {
        return stateValue;
      }

      return getNestedValue(context, path);
    }
  };
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
