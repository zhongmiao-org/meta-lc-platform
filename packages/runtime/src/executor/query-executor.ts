import type { QueryResultRow } from "@zhongmiao/meta-lc-datasource";
import type { CompiledQuery, QueryRequest } from "@zhongmiao/meta-lc-query";
import { resolveExpression } from "../dsl/expression";
import {
  QueryExecutorError,
  type QueryNodeDefinition,
  type RuntimeContext,
  type RuntimeStateStore,
  type ViewExpression
} from "../types";
import {
  createQueryCompilerAdapter,
  type QueryCompilerAdapter,
  type QueryDatasourceAdapter
} from "../adapter/query-adapter";

export interface QueryExecutorDependencies {
  compiler?: QueryCompilerAdapter;
  datasource: QueryDatasourceAdapter;
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
  const resolvedNode = resolveExpression(node as unknown as ViewExpression, new QueryExpressionStateSource(state, context)) as ResolvedQueryNodeDefinition;
  const request = buildQueryRequest(resolvedNode);

  let compiled: CompiledQuery;
  try {
    compiled = compiler.compile(request);
  } catch (error) {
    throw new QueryExecutorError(
      `Failed to compile query node "${String(resolvedNode.type ?? node.type)}" for table "${request.table}". ${
        getErrorMessage(error)
      }`,
      "compile",
      error
    );
  }

  try {
    return await dependencies.datasource.query(compiled.sql, compiled.params);
  } catch (error) {
    throw new QueryExecutorError(
      `Failed to execute query node "${String(resolvedNode.type ?? node.type)}" for table "${request.table}". ${
        getErrorMessage(error)
      }`,
      "execute",
      error
    );
  }
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
