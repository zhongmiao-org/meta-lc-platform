import { resolveExpression } from "../../domain/dsl/expression";
import {
  InMemoryMetaKernelRepository,
  META_KERNEL_APP_ID,
  META_KERNEL_DEFINITION_SEEDS,
  MetaKernelService
} from "@zhongmiao/meta-lc-kernel";
import {
  type MergeExecutorDependencies,
  executeMergeNode
} from "./merge-executor";
import { executeMutationNode } from "./mutation-executor";
import { executeQueryNode } from "./query-executor";
import type { RuntimeExecutorDependencies } from "./runtime-executor";
import type { RuntimeAuditObserver } from "@zhongmiao/meta-lc-audit";
import {
  PostgresDatasourceAdapter,
  PostgresOrdersMutationAdapter,
  PostgresOrgScopeAdapter,
  type DbConfig,
  type PostgresOrgScopeData
} from "@zhongmiao/meta-lc-datasource";
import { executeSubmitPlan, type SubmitExecutionResult } from "./submit-executor";
import type {
  RuntimeContext,
  RuntimeStateStore
} from "../../types";
import type { TransformNodeDefinition, ViewDefinition } from "@zhongmiao/meta-lc-kernel";
import type { OrgNode, OrgScopeContext, RoleDataPolicy } from "@zhongmiao/meta-lc-permission";
import type {
  QueryCompilerAdapter,
  QueryDatasourceAdapter,
  QueryPermissionAdapter
} from "../../infra/adapter/query.adapter";
import type { MutationDatasourceAdapter } from "../../infra/adapter/mutation.adapter";
import { compileViewDefinition } from "../compiler/view-compiler";

export interface RuntimeGatewayViewRequest {
  tenantId: string;
  userId: string;
  roles: string[];
  input?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface RuntimeGatewayViewOptions {
  appId?: string;
  metaKernel?: Pick<MetaKernelService, "getViewDefinition">;
  queryDatasource?: QueryDatasourceAdapter & ClosableResource;
  mutationDatasource?: MutationDatasourceAdapter & ClosableResource;
  orgScopeResolver?: RuntimeOrgScopeResolver & ClosableResource;
  auditObserver?: RuntimeAuditObserver & ClosableResource;
  businessDbConfig?: DbConfig;
}

export interface RuntimeOrgScopeResolver {
  resolve(input: { tenantId: string; userId: string; roles: string[] }): Promise<OrgScopeContext>;
}

export class RuntimeViewNotFoundError extends Error {
  constructor(viewName: string) {
    super(`view "${viewName}" not found`);
    this.name = "RuntimeViewNotFoundError";
  }
}

export class RuntimeGatewayRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeGatewayRequestError";
  }
}

export interface RuntimeViewExecutorDependencies {
  queryCompiler?: QueryCompilerAdapter;
  queryPermission?: QueryPermissionAdapter;
  queryDatasource: QueryDatasourceAdapter;
  mutationDatasource: MutationDatasourceAdapter;
  merge?: MergeExecutorDependencies;
  auditObserver?: RuntimeAuditObserver;
}

interface ClosableResource {
  close?(): Promise<void>;
}

export async function executeRuntimeGatewayView(
  viewName: string,
  request: RuntimeGatewayViewRequest & { requestId: string },
  options: RuntimeGatewayViewOptions = {}
): Promise<SubmitExecutionResult> {
  ensureRuntimeGatewayRequest(request);
  const resources: ClosableResource[] = [];
  const metaKernel = options.metaKernel ?? createDefaultMetaKernel();
  const view = await metaKernel.getViewDefinition(options.appId ?? META_KERNEL_APP_ID, viewName);
  if (!view) {
    throw new RuntimeViewNotFoundError(viewName);
  }

  const businessConfig =
    options.queryDatasource && options.mutationDatasource && options.orgScopeResolver
      ? undefined
      : options.businessDbConfig ?? loadRuntimeDbConfig("business");
  const queryDatasource =
    options.queryDatasource ?? track(resources, new PostgresDatasourceAdapter(readBusinessConfig(businessConfig)));
  const mutationDatasource =
    options.mutationDatasource ?? track(resources, new PostgresOrdersMutationAdapter(readBusinessConfig(businessConfig)));
  const orgScopeResolver =
    options.orgScopeResolver ?? track(resources, createDefaultOrgScopeResolver(readBusinessConfig(businessConfig)));
  const auditObserver = options.auditObserver ?? createNoopRuntimeAuditObserver();

  try {
    const orgScope = await orgScopeResolver.resolve({
      tenantId: request.tenantId,
      userId: request.userId,
      roles: request.roles
    });
    const runtimeContext = buildRuntimeGatewayContext(request, viewName, orgScope);
    return executeRuntimeView(view.definition, runtimeContext, {
      queryDatasource,
      mutationDatasource,
      auditObserver
    });
  } finally {
    await Promise.all(resources.map((resource) => resource.close?.()));
  }
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

function createDefaultMetaKernel(): MetaKernelService {
  return new MetaKernelService(
    new InMemoryMetaKernelRepository({
      definitions: META_KERNEL_DEFINITION_SEEDS
    })
  );
}

function createNoopRuntimeAuditObserver(): RuntimeAuditObserver {
  return {
    recordRuntimeEvent() {}
  };
}

function createDefaultOrgScopeResolver(config: DbConfig): RuntimeOrgScopeResolver & ClosableResource {
  const adapter = new PostgresOrgScopeAdapter(config);
  return {
    async resolve(input) {
      try {
        const data = await adapter.resolve({
          tenantId: input.tenantId,
          userId: input.userId
        });
        return mapOrgScopeData(input, data);
      } catch (error) {
        if (getPgErrorCode(error) === "42P01") {
          return {
            tenantId: input.tenantId,
            userId: input.userId,
            roles: input.roles,
            userOrgIds: [],
            rolePolicies: [],
            orgNodes: []
          };
        }
        throw error;
      }
    },
    close: () => adapter.close()
  };
}

function mapOrgScopeData(
  input: { tenantId: string; userId: string; roles: string[] },
  data: PostgresOrgScopeData
): OrgScopeContext {
  const roles = Array.from(new Set([...input.roles, ...data.roleBindings]));
  return {
    tenantId: input.tenantId,
    userId: input.userId,
    roles,
    userOrgIds: data.userOrgIds,
    rolePolicies: data.rolePolicies
      .filter((policy) => roles.includes(policy.role))
      .map<RoleDataPolicy>((policy) => ({
        role: policy.role,
        scope: normalizeScope(policy.scope),
        customOrgIds: policy.customOrgIds
      })),
    orgNodes: data.orgNodes.map<OrgNode>((node) => ({
      id: node.id,
      tenantId: node.tenantId,
      parentId: node.parentId,
      path: node.path,
      name: node.name,
      type: node.type
    }))
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

function normalizeScope(value: string): RoleDataPolicy["scope"] {
  const normalized = value.toUpperCase();
  if (
    normalized === "SELF" ||
    normalized === "DEPT" ||
    normalized === "DEPT_AND_CHILDREN" ||
    normalized === "CUSTOM_ORG_SET" ||
    normalized === "TENANT_ALL"
  ) {
    return normalized;
  }
  return "SELF";
}

function track<T extends ClosableResource>(resources: ClosableResource[], resource: T): T {
  resources.push(resource);
  return resource;
}

function loadRuntimeDbConfig(target: "business" | "audit"): DbConfig {
  const prefix = target === "business" ? "BUSINESS" : "AUDIT";
  const url = process.env[`LC_DB_${prefix}_URL`];
  if (url) {
    return parseRuntimeDbUrl(url);
  }
  return {
    host: readRequiredEnv("LC_DB_HOST"),
    port: readPort(process.env.LC_DB_PORT, 5432),
    user: readRequiredEnv("LC_DB_USER"),
    password: readRequiredEnv("LC_DB_PASSWORD"),
    database:
      process.env[`LC_DB_${prefix}_NAME`] ??
      process.env.LC_DB_NAME ??
      (target === "business" ? "business_db" : "audit_db"),
    ssl: (process.env.LC_DB_SSL ?? "false").toLowerCase() === "true"
  };
}

function readBusinessConfig(config: DbConfig | undefined): DbConfig {
  if (!config) {
    throw new Error("business DB config is required for default runtime gateway dependencies.");
  }
  return config;
}

function parseRuntimeDbUrl(value: string): DbConfig {
  const url = new URL(value);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`Unsupported database url protocol: ${url.protocol}`);
  }
  return {
    url: value,
    host: url.hostname,
    port: Number(url.port || "5432"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ssl: (url.searchParams.get("sslmode") ?? "").toLowerCase() === "require"
  };
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function readPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPgErrorCode(error: unknown): string {
  return String((error as { code?: string })?.code ?? "");
}
