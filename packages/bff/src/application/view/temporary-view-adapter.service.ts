import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  compileViewDefinition,
  executeMergeNode,
  executeMutationNode,
  executeQueryNode,
  executeSubmitPlan,
  resolveExpression,
  type RuntimeContext,
  type RuntimeExecutionResult,
  type RuntimeStateStore,
  type ViewDefinition,
  type RuntimeExecutorDependencies
} from "@zhongmiao/meta-lc-runtime";
import { MetaRegistryService } from "../../interface/gateway/meta-registry.service";
import { OrgScopeService } from "../../infra/integration/org-scope.service";
import { PostgresQueryExecutorService } from "../../infra/integration/postgres-query-executor.service";
import type { ViewApiRequest } from "./view.contract";

export interface TemporaryViewExecutionResult {
  requestId: string;
  viewName: string;
  runtime: RuntimeExecutionResult;
}

@Injectable()
export class TemporaryViewAdapter {
  constructor(
    private readonly registry: MetaRegistryService,
    private readonly queryExecutor: PostgresQueryExecutorService,
    private readonly orgScopeService: OrgScopeService
  ) {}

  async execute(viewName: string, request: ViewApiRequest, requestId: string): Promise<TemporaryViewExecutionResult> {
    const view = this.lookupView(viewName);
    const runtimeContext = await this.buildRuntimeContext(request, requestId, viewName);
    const plan = compileViewDefinition(view);
    const runtime = await executeSubmitPlan(plan, runtimeContext, {
      executors: this.createNodeExecutors()
    });

    return {
      requestId,
      viewName,
      runtime
    };
  }

  private lookupView(viewName: string): ViewDefinition {
    const view = this.registry.getView(viewName);
    if (!view) {
      throw new NotFoundException(`view "${viewName}" not found`);
    }
    return view;
  }

  private async buildRuntimeContext(
    request: ViewApiRequest,
    requestId: string,
    viewName: string
  ): Promise<RuntimeContext> {
    this.ensureAuthRequest(request);
    const orgScope = await this.orgScopeService.resolveContext({
      tenantId: request.tenantId,
      userId: request.userId,
      roles: request.roles
    });
    const requestContext = {
      requestId,
      tenantId: request.tenantId,
      userId: request.userId,
      roles: [...request.roles],
      ...(request.context ?? {})
    };

    return {
      requestId,
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

  private ensureAuthRequest(request: ViewApiRequest): void {
    if (!request.tenantId?.trim() || !request.userId?.trim()) {
      throw new BadRequestException("tenantId and userId are required.");
    }
    if (!Array.isArray(request.roles)) {
      throw new BadRequestException("roles must be an array.");
    }
  }

  private createNodeExecutors(): RuntimeExecutorDependencies["executors"] {
    const queryExecutor = this.queryExecutor;
    return {
      query: async (node, state, context) =>
        executeQueryNode(node, state, context, {
          datasource: {
            async query(sql, params = []) {
              return queryExecutor.query(sql, params);
            }
          }
        }),
      mutation: async (node, state, context) =>
        executeMutationNode(node, state, context, {
          adapter: {
            async execute(command) {
              if (command.model !== "orders") {
                throw new BadRequestException(`unsupported mutation model "${command.model}"`);
              }

              const payload = command.payload as Record<string, unknown>;
              const id = readRequiredString(payload.id, "payload.id");
              const orgId = readNullableString(payload.orgId ?? null, "payload.orgId");
              const owner = readOptionalString(payload.owner, "payload.owner");
              const channel = readOptionalString(payload.channel, "payload.channel");
              const priority = readOptionalString(payload.priority, "payload.priority");
              const status = readOptionalString(payload.status, "payload.status");

              if (command.operation !== "delete" && !owner) {
                throw new BadRequestException("payload.owner is required for orders mutation.");
              }

              const result = await queryExecutor.mutateOrder({
                operation: command.operation,
                tenantId: String(command.context.tenantId ?? ""),
                userId: String(command.context.userId ?? ""),
                superAdmin: Array.isArray(command.context.roles)
                  ? command.context.roles.includes("SUPER_ADMIN")
                  : false,
                orgId,
                payload: {
                  id,
                  orgId,
                  ...(owner ? { owner } : {}),
                  ...(channel ? { channel } : {}),
                  ...(priority ? { priority } : {}),
                  ...(status ? { status } : {})
                }
              });

              return {
                rowCount: result.rowCount,
                row: result.afterData ?? result.beforeData,
                beforeData: result.beforeData,
                afterData: result.afterData
              };
            }
          }
        }),
      merge: async (node, state, context) => executeMergeNode(node, state, context),
      transform: async (node, state, context) =>
        resolveExpression(node.definition as never, createExpressionStateSource(state, context))
    };
  }
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

function readRequiredString(value: unknown, key: string): string {
  const result = readOptionalString(value, key);
  if (!result) {
    throw new BadRequestException(`${key} is required.`);
  }
  return result;
}

function readOptionalString(value: unknown, key: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new BadRequestException(`${key} must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readNullableString(value: unknown, key: string): string | null {
  const result = readOptionalString(value, key);
  return result ?? null;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
