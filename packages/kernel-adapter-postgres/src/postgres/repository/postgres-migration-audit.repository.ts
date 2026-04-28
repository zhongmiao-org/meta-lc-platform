import { randomUUID } from "node:crypto";
import { createMigrationSafetyReport } from "@zhongmiao/meta-lc-kernel";
import type {
  MigrationAuditRecord,
  MigrationGuardOptions
} from "@zhongmiao/meta-lc-kernel";
import type { MigrationExecutionContext } from "../interfaces/migration-execution-context.interface";
import type { MigrationAuditStatus } from "../types/migration-audit-status.type";
import type { createPostgresPool } from "../utils/postgres-pool.util";

type PostgresPool = ReturnType<typeof createPostgresPool>;

export class PostgresMigrationAuditRepository {
  constructor(private readonly pool: PostgresPool) {}

  async executeMigration(
    statements: string[],
    options: MigrationGuardOptions = {},
    context?: MigrationExecutionContext
  ): Promise<{ auditCount: number }> {
    let auditCount = 0;
    if (statements.length === 0) {
      return { auditCount };
    }

    const requestId = context?.requestId?.trim() ? context.requestId : randomUUID();
    const executionContext = {
      appId: context?.appId ?? "__unknown_app__",
      fromVersion: context?.fromVersion ?? 0,
      toVersion: context?.toVersion ?? 0,
      requestId
    };
    const safetyReport = createMigrationSafetyReport(statements, options);
    if (safetyReport.blockedStatements.length > 0) {
      for (const statement of safetyReport.blockedStatements) {
        const inserted = await this.persistAuditSafely({
          ...executionContext,
          statement,
          status: "blocked",
          errorMessage: "Blocked destructive migration statement",
          durationMs: 0
        });
        if (inserted) {
          auditCount += 1;
        }
      }
      throw new Error(
        `Blocked destructive migration statements: ${safetyReport.blockedStatements.join(" | ")}`
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const statement of statements) {
        const startedAt = Date.now();
        try {
          await client.query(statement);
          const inserted = await this.persistAuditSafely({
            ...executionContext,
            statement,
            status: "success",
            errorMessage: null,
            durationMs: Date.now() - startedAt
          });
          if (inserted) {
            auditCount += 1;
          }
        } catch (error) {
          const inserted = await this.persistAuditSafely({
            ...executionContext,
            statement,
            status: "failure",
            errorMessage: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startedAt
          });
          if (inserted) {
            auditCount += 1;
          }
          throw error;
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return { auditCount };
  }

  async listMigrationAudits(requestId: string): Promise<MigrationAuditRecord[]> {
    const result = await this.pool.query<{
      app_id: string;
      from_version: number;
      to_version: number;
      statement: string;
      status: MigrationAuditStatus;
      error_message: string | null;
      duration_ms: number;
      request_id: string;
    }>(
      `SELECT
        app_id,
        from_version,
        to_version,
        statement,
        status,
        error_message,
        duration_ms,
        request_id
      FROM meta_kernel_migration_audits
      WHERE request_id = $1
      ORDER BY id ASC`,
      [requestId]
    );

    return result.rows.map((row) => ({
      appId: row.app_id,
      fromVersion: row.from_version,
      toVersion: row.to_version,
      statement: row.statement,
      status: row.status,
      errorMessage: row.error_message,
      durationMs: row.duration_ms,
      requestId: row.request_id
    }));
  }

  async persistAuditSafely(record: MigrationAuditRecord): Promise<boolean> {
    try {
      await this.pool.query(
        `INSERT INTO meta_kernel_migration_audits (
          app_id,
          from_version,
          to_version,
          statement,
          status,
          error_message,
          duration_ms,
          request_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          record.appId,
          record.fromVersion,
          record.toVersion,
          record.statement,
          record.status,
          record.errorMessage,
          record.durationMs,
          record.requestId
        ]
      );
      return true;
    } catch {
      return false;
    }
  }
}
