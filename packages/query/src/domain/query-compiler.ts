import type { CompiledQuery, QueryRequest } from "../types/shared.types";

function quoteIdentifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }
  return `"${value}"`;
}

export function compileSelectQuery(request: QueryRequest): CompiledQuery {
  if (!request.fields.length) {
    throw new Error("At least one field is required.");
  }

  const params: Array<string | number | boolean> = [];
  const quotedFields = request.fields.map(quoteIdentifier).join(", ");
  const quotedTable = quoteIdentifier(request.table);
  const whereParts: string[] = [];

  for (const [key, value] of Object.entries(request.filters ?? {})) {
    if (key === "keyword" && typeof value === "string" && value.trim()) {
      const likeParamIndex = params.push(`%${value.trim()}%`);
      whereParts.push(`("id" ILIKE $${likeParamIndex} OR "owner" ILIKE $${likeParamIndex})`);
      continue;
    }

    if (!SUPPORTED_EXACT_FILTERS.has(key)) {
      continue;
    }

    params.push(value);
    whereParts.push(`${quoteIdentifier(key)} = $${params.length}`);
  }

  const whereSql = whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : "";
  const limit = Number.isFinite(request.limit) ? Math.max(1, Number(request.limit)) : 100;
  const sql = `SELECT ${quotedFields} FROM ${quotedTable}${whereSql} LIMIT ${limit}`;

  return { sql, params };
}

const SUPPORTED_EXACT_FILTERS = new Set([
  "status",
  "owner",
  "channel",
  "priority",
  "org_id",
  "tenant_id",
  "created_by"
]);
