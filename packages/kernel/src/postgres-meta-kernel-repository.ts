import { Pool } from "pg";
import { createMigrationSafetyReport, type MigrationGuardOptions } from "./migration-safety";
import { randomUUID } from "node:crypto";
import type {
  DbConfig,
  MetaSchema,
  MetaVersion,
  MigrationAuditRecord
} from "./types";

interface MigrationExecutionContext {
  appId: string;
  fromVersion: number;
  toVersion: number;
  requestId?: string;
}

export class PostgresMetaKernelRepository {
  private readonly pool: Pool;

  constructor(config: DbConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false
    });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS meta_kernel_versions (
        id BIGSERIAL PRIMARY KEY,
        app_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        schema_json JSONB NOT NULL,
        metadata_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (app_id, version)
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS meta_kernel_migration_audits (
        id BIGSERIAL PRIMARY KEY,
        app_id TEXT NOT NULL,
        from_version INTEGER NOT NULL,
        to_version INTEGER NOT NULL,
        statement TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT NULL,
        duration_ms INTEGER NOT NULL,
        request_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_meta_kernel_migration_audits_request_id
      ON meta_kernel_migration_audits (request_id)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_meta_kernel_migration_audits_app_created
      ON meta_kernel_migration_audits (app_id, created_at DESC)
    `);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async getLatestVersion(appId: string): Promise<MetaVersion | null> {
    const result = await this.pool.query(
      `SELECT app_id, version, schema_json, metadata_json
       FROM meta_kernel_versions
       WHERE app_id = $1
       ORDER BY version DESC
       LIMIT 1`,
      [appId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapRow(result.rows[0]);
  }

  async getVersion(appId: string, version: number): Promise<MetaVersion | null> {
    const result = await this.pool.query(
      `SELECT app_id, version, schema_json, metadata_json
       FROM meta_kernel_versions
       WHERE app_id = $1 AND version = $2
       LIMIT 1`,
      [appId, version]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return mapRow(result.rows[0]);
  }

  async listVersions(appId: string): Promise<MetaVersion[]> {
    const result = await this.pool.query(
      `SELECT app_id, version, schema_json, metadata_json
       FROM meta_kernel_versions
       WHERE app_id = $1
       ORDER BY version ASC`,
      [appId]
    );
    return result.rows.map(mapRow);
  }

  async createVersion(input: {
    appId: string;
    schema: MetaSchema;
    metadata: { author: string; message: string; rollbackFromVersion?: number | null };
  }): Promise<MetaVersion> {
    const latest = await this.getLatestVersion(input.appId);
    const nextVersion = latest ? latest.version + 1 : 1;
    const metadata = {
      author: input.metadata.author,
      message: input.metadata.message,
      createdAt: new Date().toISOString(),
      rollbackFromVersion: input.metadata.rollbackFromVersion ?? null
    };

    const result = await this.pool.query(
      `INSERT INTO meta_kernel_versions (app_id, version, schema_json, metadata_json)
       VALUES ($1, $2, $3::jsonb, $4::jsonb)
       RETURNING app_id, version, schema_json, metadata_json`,
      [input.appId, nextVersion, JSON.stringify(input.schema), JSON.stringify(metadata)]
    );
    return mapRow(result.rows[0]);
  }

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
    const result = await this.pool.query(
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

  private async persistAuditSafely(record: MigrationAuditRecord): Promise<boolean> {
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

function mapRow(row: {
  app_id: string;
  version: number;
  schema_json: MetaSchema;
  metadata_json: MetaVersion["metadata"];
}): MetaVersion {
  return {
    appId: row.app_id,
    version: row.version,
    schema: row.schema_json,
    metadata: row.metadata_json
  };
}
