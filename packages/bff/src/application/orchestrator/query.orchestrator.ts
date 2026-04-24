import { Injectable } from "@nestjs/common";
import { buildDataScopeFilter, injectPermissionClause, resolveDataScope } from "@zhongmiao/meta-lc-permission";
import { compileSelectQuery } from "@zhongmiao/meta-lc-query";
import { formatSqlWithParams, shiftSqlParams } from "@zhongmiao/meta-lc-shared";
import type { DataScopeDecision, QueryApiRequest } from "@zhongmiao/meta-lc-contracts";
import { ForbiddenDataScopeError } from "../../common/permission-errors";
import { OrgScopeService } from "../../infra/integration/org-scope.service";
import { PostgresQueryExecutorService } from "../../infra/integration/postgres-query.service";

export interface QueryExecutionResult {
  rows: Record<string, unknown>[];
  finalSql: string;
  permissionDecision: DataScopeDecision;
}

@Injectable()
export class QueryOrchestratorService {
  constructor(
    private readonly queryExecutor: PostgresQueryExecutorService,
    private readonly orgScopeService: OrgScopeService
  ) {}

  async execute(request: QueryApiRequest): Promise<QueryExecutionResult> {
    const orgScopeContext = await this.orgScopeService.resolveContext({
      tenantId: request.tenantId,
      userId: request.userId,
      roles: request.roles
    });
    const permissionDecision = resolveDataScope(orgScopeContext);
    ensureOrgFilterInScope(request, permissionDecision);

    const { sql, params } = compileQueryWithPermission(request, permissionDecision);
    const rows = await this.queryExecutor.query(sql, params);
    return {
      rows,
      finalSql: formatSqlWithParams(sql, params),
      permissionDecision
    };
  }

  async health(): Promise<boolean> {
    return this.queryExecutor.health();
  }
}

export function compileQueryWithPermission(
  request: QueryApiRequest,
  decision: DataScopeDecision
): {
  sql: string;
  params: Array<string | number | boolean | string[]>;
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
  const permission = buildDataScopeFilter(decision, {
    tenantId: request.tenantId,
    userId: request.userId,
    roles: request.roles
  });

  let sql = compiled.sql;
  const params: Array<string | number | boolean | string[]> = [...compiled.params];
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

function ensureOrgFilterInScope(request: QueryApiRequest, decision: DataScopeDecision): void {
  const requestedOrgIdRaw = request.filters?.["org_id"];
  if (!requestedOrgIdRaw || typeof requestedOrgIdRaw !== "string") {
    return;
  }
  if (decision.tenantAll) {
    return;
  }
  if (!decision.allowedOrgIds.includes(requestedOrgIdRaw)) {
    throw new ForbiddenDataScopeError({
      decision,
      reason: `org_id ${requestedOrgIdRaw} is out of scope`
    });
  }
}
