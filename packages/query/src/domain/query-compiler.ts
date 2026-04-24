import type {
  CompiledQuery,
  QueryComparisonPredicate,
  QueryFieldRef,
  QueryInPredicate,
  QueryIsNullPredicate,
  QueryLiteralPredicate,
  QueryLogicalPredicate,
  QueryPredicate,
  QueryRequest,
  QueryScalarValue,
  QuerySelectItem,
  QueryTableRef,
  SelectQueryAst
} from "../types/shared.types";

const DEFAULT_LIMIT = 100;
const KEYWORD_SEARCH_FIELDS = ["id", "owner"] as const;
const SUPPORTED_EXACT_FILTERS = new Set([
  "status",
  "owner",
  "channel",
  "priority",
  "org_id",
  "tenant_id",
  "created_by"
]);

function quoteIdentifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }
  return `"${value}"`;
}

export function buildSelectQueryAst(request: QueryRequest): SelectQueryAst {
  if (!request.fields.length) {
    throw new Error("At least one field is required.");
  }

  const predicates: QueryPredicate[] = [];

  for (const [key, value] of Object.entries(request.filters ?? {})) {
    if (key === "keyword" && typeof value === "string" && value.trim()) {
      const keyword = `%${value.trim()}%`;
      predicates.push({
        type: "logical",
        operator: "or",
        predicates: KEYWORD_SEARCH_FIELDS.map((field) => ({
          type: "comparison",
          left: { name: field },
          operator: "ilike",
          value: keyword
        }))
      });
      continue;
    }

    if (!SUPPORTED_EXACT_FILTERS.has(key)) {
      continue;
    }

    predicates.push({
      type: "comparison",
      left: { name: key },
      operator: "eq",
      value
    });
  }

  return {
    type: "select",
    table: { name: request.table },
    fields: request.fields.map((field) => ({ name: field })),
    ...(predicates.length > 0
      ? {
          where: {
            type: "logical",
            operator: "and",
            predicates
          }
        }
      : {}),
    limit: normalizeLimit(request.limit)
  };
}

export function compileSelectAst(ast: SelectQueryAst): CompiledQuery {
  if (ast.type !== "select") {
    throw new Error(`Unsupported query AST type: ${String(ast.type)}`);
  }
  if (!ast.fields.length) {
    throw new Error("At least one field is required.");
  }

  const params: QueryScalarValue[] = [];
  const quotedFields = ast.fields.map(compileSelectItem).join(", ");
  const quotedTable = compileTableRef(ast.table);
  const whereSql = ast.where ? ` WHERE ${compilePredicate(ast.where, params, true)}` : "";
  const limit = normalizeLimit(ast.limit);
  const sql = `SELECT ${quotedFields} FROM ${quotedTable}${whereSql} LIMIT ${limit}`;

  return { sql, params };
}

export function compileSelectQuery(request: QueryRequest): CompiledQuery {
  return compileSelectAst(buildSelectQueryAst(request));
}

function compileTableRef(table: QueryTableRef): string {
  const quotedName = quoteIdentifier(table.name);
  return table.alias ? `${quotedName} AS ${quoteIdentifier(table.alias)}` : quotedName;
}

function compileSelectItem(item: QuerySelectItem): string {
  const field = compileFieldRef(item);
  return item.alias ? `${field} AS ${quoteIdentifier(item.alias)}` : field;
}

function compilePredicate(predicate: QueryPredicate, params: QueryScalarValue[], isRoot = false): string {
  if (predicate.type === "comparison") {
    return compileComparisonPredicate(predicate, params);
  }
  if (predicate.type === "in") {
    return compileInPredicate(predicate, params);
  }
  if (predicate.type === "is_null") {
    return compileIsNullPredicate(predicate);
  }
  if (predicate.type === "literal") {
    return compileLiteralPredicate(predicate);
  }
  return compileLogicalPredicate(predicate, params, isRoot);
}

function compileComparisonPredicate(predicate: QueryComparisonPredicate, params: QueryScalarValue[]): string {
  params.push(predicate.value);
  const operator = predicate.operator === "ilike" ? "ILIKE" : "=";
  return `${compileFieldRef(predicate.left)} ${operator} $${params.length}`;
}

function compileInPredicate(predicate: QueryInPredicate, params: QueryScalarValue[]): string {
  if (!predicate.values.length) {
    return "FALSE";
  }

  const placeholders = predicate.values.map((value) => {
    params.push(value);
    return `$${params.length}`;
  });
  return `${compileFieldRef(predicate.left)} IN (${placeholders.join(", ")})`;
}

function compileIsNullPredicate(predicate: QueryIsNullPredicate): string {
  return `${compileFieldRef(predicate.left)} IS NULL`;
}

function compileLiteralPredicate(predicate: QueryLiteralPredicate): string {
  return predicate.value ? "TRUE" : "FALSE";
}

function compileLogicalPredicate(
  predicate: QueryLogicalPredicate,
  params: QueryScalarValue[],
  isRoot: boolean
): string {
  if (!predicate.predicates.length) {
    throw new Error("Logical predicate requires at least one child predicate.");
  }

  const joiner = predicate.operator === "or" ? " OR " : " AND ";
  const compiled = predicate.predicates.map((child) => compilePredicate(child, params));
  const sql = compiled.join(joiner);
  return isRoot ? sql : `(${sql})`;
}

function compileFieldRef(field: QueryFieldRef): string {
  const quotedName = quoteIdentifier(field.name);
  return field.tableAlias ? `${quoteIdentifier(field.tableAlias)}.${quotedName}` : quotedName;
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }
  return Math.max(1, Math.floor(value));
}
