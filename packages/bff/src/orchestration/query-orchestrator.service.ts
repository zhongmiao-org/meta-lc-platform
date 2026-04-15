import { Injectable } from "@nestjs/common";
import { buildRowLevelFilter, injectPermissionClause } from "@meta-lc/permission";
import { compileSelectQuery } from "@meta-lc/query";
import { formatSqlWithParams, shiftSqlParams } from "@meta-lc/shared";
import { PostgresQueryExecutorService } from "../integration/postgres-query-executor.service";
import type { QueryApiRequest } from "../types";

export interface QueryExecutionResult {
  rows: Record<string, unknown>[];
  finalSql: string;
}

@Injectable()
export class QueryOrchestratorService {
  constructor(private readonly queryExecutor: PostgresQueryExecutorService) {}

  async execute(request: QueryApiRequest): Promise<QueryExecutionResult> {
    const { sql, params } = compileQueryWithPermission(request);
    const rows = await this.queryExecutor.query(sql, params);
    return {
      rows,
      finalSql: formatSqlWithParams(sql, params)
    };
  }

  async health(): Promise<boolean> {
    return this.queryExecutor.health();
  }
}

export function compileQueryWithPermission(request: QueryApiRequest): {
  sql: string;
  params: Array<string | number | boolean>;
} {
  if (!request.tenantId || !request.userId) {
    throw new Error("tenantId and userId are required.");
  }

  const compiled = compileSelectQuery({
    table: request.table,
    fields: request.fields,
    filters: request.filters,
    limit: request.limit
  });
  const permission = buildRowLevelFilter({
    tenantId: request.tenantId,
    userId: request.userId,
    roles: request.roles
  });

  let sql = compiled.sql;
  const params = [...compiled.params];
  if (permission.clause !== "1=1") {
    const shiftedClause = shiftSqlParams(permission.clause, params.length);
    sql = injectPermissionClause(sql, { clause: shiftedClause, params: [] });
    params.push(...permission.params);
  }

  return {
    sql,
    params
  };
}
