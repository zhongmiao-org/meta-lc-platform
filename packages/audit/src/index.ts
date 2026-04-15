import { Pool } from "pg";
import type { QueryAuditLog } from "@meta-lc/contracts";

export interface MutationAuditLog {
  requestId: string;
  tenantId: string;
  userId: string;
  table: string;
  action: "create" | "update" | "delete";
  payload: string;
  status: "success" | "failure";
  errorMessage?: string | null;
}

export interface MigrationAuditLog {
  requestId: string;
  appId: string;
  fromVersion: number;
  toVersion: number;
  statement: string;
  status: "success" | "failure" | "blocked";
  durationMs: number;
  errorMessage?: string | null;
}

export interface AccessAuditLog {
  requestId: string;
  tenantId: string;
  userId: string;
  resource: string;
  action: string;
  status: "allow" | "deny";
  reason?: string;
}

export interface AuditDbConfig {
  connectionString: string;
}

export class AuditService {
  private readonly pool: Pool;

  constructor(config: AuditDbConfig) {
    this.pool = new Pool({ connectionString: config.connectionString });
  }

  async logQuery(log: QueryAuditLog): Promise<void> {
    await this.pool.query(
      `INSERT INTO query_logs (
        request_id, tenant_id, user_id, query_dsl, final_sql, duration_ms, result_count, status, error_message
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        log.requestId,
        log.tenantId,
        log.userId,
        log.queryDsl,
        log.finalSql,
        log.durationMs,
        log.resultCount,
        log.status,
        log.errorMessage ?? null
      ]
    );
  }

  async logMutation(log: MutationAuditLog): Promise<void> {
    await this.pool.query(
      `INSERT INTO mutation_logs (
        request_id, tenant_id, user_id, table_name, action, payload, status, error_message
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        log.requestId,
        log.tenantId,
        log.userId,
        log.table,
        log.action,
        log.payload,
        log.status,
        log.errorMessage ?? null
      ]
    );
  }

  async logMigration(log: MigrationAuditLog): Promise<void> {
    await this.pool.query(
      `INSERT INTO migration_logs (
        request_id, app_id, from_version, to_version, statement, status, duration_ms, error_message
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        log.requestId,
        log.appId,
        log.fromVersion,
        log.toVersion,
        log.statement,
        log.status,
        log.durationMs,
        log.errorMessage ?? null
      ]
    );
  }

  async logAccess(log: AccessAuditLog): Promise<void> {
    await this.pool.query(
      `INSERT INTO access_logs (
        request_id, tenant_id, user_id, resource, action, status, reason
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        log.requestId,
        log.tenantId,
        log.userId,
        log.resource,
        log.action,
        log.status,
        log.reason ?? null
      ]
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
