import { resolveExpression } from "../../domain/dsl/expression";
import {
  executeMergeNode
} from "../executor/merge-executor";
import { executeMutationNode } from "../executor/mutation-executor";
import { executeQueryNode } from "../executor/query-executor";
import type { RuntimeAuditObserver } from "@zhongmiao/meta-lc-audit";
import { executeSubmitPlan } from "../executor/submit-executor";
import type {
  MutationDatasourceAdapter,
  RuntimeExecutorDependencies,
  RuntimeGatewayViewOptions,
  RuntimeGatewayViewRequest,
  RuntimeStateStore,
  RuntimeViewExecutorDependencies,
  SubmitExecutionResult
} from "../../core/interfaces";
import type { RuntimeContext } from "../../core/types";
import type { TransformNodeDefinition, ViewDefinition } from "@zhongmiao/meta-lc-kernel";
import type { OrgScopeContext } from "@zhongmiao/meta-lc-permission";
import { compileViewDefinition } from "../compiler/view-compiler";
import { RuntimeGatewayRequestError, RuntimeViewNotFoundError } from "../../core/errors";

export async function executeRuntimeGatewayView(
  viewName: string,
  request: RuntimeGatewayViewRequest & { requestId: string },
  options?: RuntimeGatewayViewOptions
): Promise<SubmitExecutionResult> {
  ensureRuntimeGatewayRequest(request);
  const metaKernel = options?.metaKernel ?? failMissingRuntimeGatewayDependency("metaKernel");
  const appId = options?.appId ?? failMissingRuntimeGatewayDependency("appId");
  const queryDatasource = options?.queryDatasource ?? failMissingRuntimeGatewayDependency("queryDatasource");
  const orgScopeResolver = options?.orgScopeResolver ?? failMissingRuntimeGatewayDependency("orgScopeResolver");
  const view = await metaKernel.getViewDefinition(appId, viewName);
  if (!view) {
    throw new RuntimeViewNotFoundError(viewName);
  }

  const mutationDatasource = options?.mutationDatasource;
  const auditObserver = options?.auditObserver ?? createNoopRuntimeAuditObserver();

  const orgScope = await orgScopeResolver.resolve({
    tenantId: request.tenantId,
    userId: request.userId,
    roles: request.roles
  });
  const runtimeContext = buildRuntimeGatewayContext(request, viewName, orgScope);
  return executeRuntimeView(view.definition, runtimeContext, {
    queryDatasource,
    ...(mutationDatasource ? { mutationDatasource } : {}),
    auditObserver
  });
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
        adapter: dependencies.mutationDatasource ?? createUnavailableMutationDatasourceAdapter()
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

function createUnavailableMutationDatasourceAdapter(): MutationDatasourceAdapter {
  return {
    async execute(command) {
      throw new Error(
        `No mutation datasource adapter configured for model "${command.model}" and operation "${command.operation}".`
      );
    }
  };
}

function createNoopRuntimeAuditObserver(): RuntimeAuditObserver {
  return {
    recordRuntimeEvent() {}
  };
}

function buildRuntimeGatewayContext(
  request: RuntimeGatewayViewRequest & { requestId: string },
  viewName: string,
  orgScope: OrgScopeContext
): RuntimeContext {
  const requestContext = {
    requestId: request.requestId,
    tenantId: request.tenantId,
    userId: request.userId,
    roles: [...request.roles],
    ...(request.context ?? {})
  };

  return {
    requestId: request.requestId,
    viewName,
    tenantId: request.tenantId,
    userId: request.userId,
    roles: [...request.roles],
    input: { ...(request.input ?? {}) },
    ...(request.context ?? {}),
    context: requestContext,
    auth: {
      tenantId: request.tenantId,
      userId: request.userId,
      roles: [...request.roles]
    },
    orgScope
  };
}

function ensureRuntimeGatewayRequest(request: RuntimeGatewayViewRequest): void {
  if (!request.tenantId?.trim() || !request.userId?.trim()) {
    throw new RuntimeGatewayRequestError("tenantId and userId are required.");
  }
  if (!Array.isArray(request.roles)) {
    throw new RuntimeGatewayRequestError("roles must be an array.");
  }
}

function failMissingRuntimeGatewayDependency(name: string): never {
  throw new RuntimeGatewayRequestError(`Runtime gateway option "${name}" is required.`);
}
