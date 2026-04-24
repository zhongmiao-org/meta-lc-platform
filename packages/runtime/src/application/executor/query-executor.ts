import type { QueryResultRow } from "@zhongmiao/meta-lc-datasource";
import type { CompiledQuery, QueryRequest, SelectQueryAst } from "@zhongmiao/meta-lc-query";
import type { OrgScopeContext } from "@zhongmiao/meta-lc-contracts";
import type { PermissionAstTransformContext } from "@zhongmiao/meta-lc-permission";
import type { RuntimeAuditObserver } from "@zhongmiao/meta-lc-audit";
import { resolveExpression } from "../../domain/dsl/expression";
import {
  QueryExecutorError,
  type QueryNodeDefinition,
  type RuntimeContext,
  type RuntimeStateStore,
  type ViewExpression
} from "../../types";
import {
  createQueryCompilerAdapter,
  createQueryPermissionAdapter,
  type QueryCompilerAdapter,
  type QueryDatasourceAdapter,
  type QueryPermissionAdapter
} from "../../infra/adapter/query.adapter";
import {
  createRuntimeAuditDispatchContext,
  emitRuntimeAuditEvent,
  getErrorMessage
} from "./runtime-audit";

export interface QueryAuditDependencies {
  observer?: RuntimeAuditObserver;
  nodeId?: string;
  nodeType?: string;
}

export interface QueryExecutorDependencies {
  compiler?: QueryCompilerAdapter;
  permission?: QueryPermissionAdapter;
  datasource: QueryDatasourceAdapter;
  audit?: QueryAuditDependencies;
}

export interface QueryExecutionResult {
  rows: QueryResultRow[];
  query: CompiledQuery;
  request: QueryRequest;
}

export async function executeQueryNode(
  node: QueryNodeDefinition,
  state: RuntimeStateStore,
  context: RuntimeContext,
  dependencies: QueryExecutorDependencies
): Promise<QueryResultRow[]> {
  const compiler = dependencies.compiler ?? createQueryCompilerAdapter();
  const permission = dependencies.permission ?? createQueryPermissionAdapter();
  const auditContext = createRuntimeAuditDispatchContext(context, dependencies.audit?.observer);
  const resolvedNode = resolveExpression(node as unknown as ViewExpression, new QueryExpressionStateSource(state, context)) as ResolvedQueryNodeDefinition;
  const request = buildQueryRequest(resolvedNode);
  const nodeId = dependencies.audit?.nodeId;
  const nodeType = dependencies.audit?.nodeType ?? node.type;

  let compiled: CompiledQuery;
  try {
    const ast = compiler.buildAst(request);
    let transformedAst: SelectQueryAst;
    try {
      transformedAst = permission.transform(ast, buildPermissionContext(context));
      emitRuntimeAuditEvent(auditContext, {
        type: "runtime.permission.decision",
        status: "allow",
        nodeId,
        nodeType,
        metadata: {
          table: request.table,
          fields: request.fields
        }
      });
    } catch (error) {
      emitRuntimeAuditEvent(auditContext, {
        type: "runtime.permission.decision",
        status: "deny",
        nodeId,
        nodeType,
        errorMessage: getErrorMessage(error),
        metadata: {
          table: request.table
        }
      });
      throw error;
    }
    compiled = compiler.compileAst(transformedAst);
  } catch (error) {
    throw new QueryExecutorError(
      `Failed to compile query node "${String(resolvedNode.type ?? node.type)}" for table "${request.table}". ${
        getErrorMessage(error)
      }`,
      "compile",
      error
    );
  }

  const datasourceStartedAt = Date.now();
  try {
    const result = await dependencies.datasource.execute({
      kind: "query",
      sql: compiled.sql,
      params: compiled.params
    });
    emitRuntimeAuditEvent(auditContext, {
      type: "runtime.datasource.succeeded",
      status: "success",
      nodeId,
      nodeType,
      durationMs: result.metadata.durationMs,
      metadata: {
        kind: result.metadata.kind,
        rowCount: result.rowCount,
        table: request.table
      }
    });
    return result.rows;
  } catch (error) {
    emitRuntimeAuditEvent(auditContext, {
      type: "runtime.datasource.failed",
      status: "failure",
      nodeId,
      nodeType,
      durationMs: Date.now() - datasourceStartedAt,
      errorMessage: getErrorMessage(error),
      metadata: {
        kind: "query",
        table: request.table
      }
    });
    throw new QueryExecutorError(
      `Failed to execute query node "${String(resolvedNode.type ?? node.type)}" for table "${request.table}". ${
        getErrorMessage(error)
      }`,
      "execute",
      error
    );
  }
}

function buildPermissionContext(context: RuntimeContext): PermissionAstTransformContext {
  const auth = isPlainObject(context.auth) ? context.auth : {};
  const tenantId = readContextString(context.tenantId ?? auth.tenantId, "tenantId");
  const userId = readContextString(context.userId ?? auth.userId, "userId");
  const roles = readContextStringArray(context.roles ?? auth.roles, "roles");
  const orgScope = readOrgScopeContext(context.orgScope);

  return {
    tenantId,
    userId,
    roles,
    ...(orgScope ? { orgScope } : {})
  };
}

function readContextString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new QueryExecutorError(`Runtime context is missing a valid permission "${key}" value.`, "validation");
  }
  return value.trim();
}

function readContextStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value)) {
    throw new QueryExecutorError(`Runtime context permission "${key}" must be an array.`, "validation");
  }
  return value.map((item) => readContextString(item, key));
}

function readOrgScopeContext(value: unknown): OrgScopeContext | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const tenantId = readContextString(value.tenantId, "orgScope.tenantId");
  const userId = readContextString(value.userId, "orgScope.userId");
  const roles = readContextStringArray(value.roles, "orgScope.roles");
  const userOrgIds = readContextStringArray(value.userOrgIds, "orgScope.userOrgIds");
  const rolePolicies = Array.isArray(value.rolePolicies) ? value.rolePolicies : [];
  const orgNodes = Array.isArray(value.orgNodes) ? value.orgNodes : [];

  return {
    tenantId,
    userId,
    roles,
    userOrgIds,
    rolePolicies: rolePolicies as OrgScopeContext["rolePolicies"],
    orgNodes: orgNodes as OrgScopeContext["orgNodes"]
  };
}

function buildQueryRequest(node: ResolvedQueryNodeDefinition): QueryRequest {
  const requestSource = isPlainObject(node.request) ? node.request : node;
  const table = readRequiredString(requestSource, "table");
  const fields = readStringArray(requestSource, "fields");
  const filters = readQueryFilters(requestSource.filters);
  const limit = readOptionalFiniteNumber(requestSource.limit);

  return {
    table,
    fields,
    ...(filters ? { filters } : {}),
    ...(limit !== undefined ? { limit } : {})
  };
}

function readRequiredString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new QueryExecutorError(`Query node is missing a valid "${key}" value.`, "validation");
  }
  return value.trim();
}

function readStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key];
  if (!Array.isArray(value) || value.length === 0) {
    throw new QueryExecutorError(`Query node is missing a non-empty "${key}" array.`, "validation");
  }

  const strings = value.map((item) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new QueryExecutorError(`Query node "${key}" values must be non-empty strings.`, "validation");
    }
    return item.trim();
  });

  return strings;
}

function readQueryFilters(value: unknown): Record<string, string | number | boolean> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isPlainObject(value)) {
    throw new QueryExecutorError('Query node "filters" must be an object.', "validation");
  }

  const filters: Record<string, string | number | boolean> = {};
  for (const [key, filterValue] of Object.entries(value)) {
    if (typeof filterValue === "string" || typeof filterValue === "number" || typeof filterValue === "boolean") {
      filters[key] = filterValue;
      continue;
    }

    throw new QueryExecutorError(
      `Query node filter "${key}" must resolve to a string, number, or boolean.`,
      "validation"
    );
  }

  return filters;
}

function readOptionalFiniteNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new QueryExecutorError('Query node "limit" must resolve to a finite number.', "validation");
  }
  return value;
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

class QueryExpressionStateSource {
  constructor(
    private readonly state: RuntimeStateStore,
    private readonly context: RuntimeContext
  ) {}

  get(path: string): unknown {
    if (!path.trim()) {
      return undefined;
    }

    if (path.startsWith("context.") || path.startsWith("ctx.")) {
      return getNestedValue(this.context, path.slice(path.indexOf(".") + 1));
    }

    if (path.startsWith("state.")) {
      const nestedPath = path.slice("state.".length);
      return this.state.get(nestedPath);
    }

    const directStateValue = this.state.get(path);
    if (directStateValue !== undefined) {
      return directStateValue;
    }

    const nestedContextValue = getNestedValue(this.context, path);
    if (nestedContextValue !== undefined) {
      return nestedContextValue;
    }

    return directStateValue;
  }
}

interface ResolvedQueryNodeDefinition {
  type: QueryNodeDefinition["type"];
  request?: unknown;
  table?: unknown;
  fields?: unknown;
  filters?: unknown;
  limit?: unknown;
  [key: string]: unknown;
}
