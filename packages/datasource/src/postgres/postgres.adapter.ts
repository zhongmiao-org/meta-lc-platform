import { Pool } from "pg";
import type {
  DatasourceAdapter,
  DatasourceExecutionRequest,
  DatasourceExecutionResult,
  DbConfig,
  QueryResultRow
} from "../core/interfaces";
import type { DatasourceParamValue } from "../core/types";
import { DatasourceAdapterError } from "../core/errors";

interface PostgresPoolLike {
  query(
    sql: string,
    params?: DatasourceParamValue[]
  ): Promise<{ rows: QueryResultRow[]; rowCount: number | null }>;
  end(): Promise<void>;
}

export class PostgresDatasourceAdapter implements DatasourceAdapter {
  private readonly pool: PostgresPoolLike;

  constructor(config: DbConfig, pool?: PostgresPoolLike) {
    this.pool = pool ?? createPool(config);
  }

  async healthCheck(): Promise<boolean> {
    const result = await this.pool.query("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  }

  async execute(request: DatasourceExecutionRequest): Promise<DatasourceExecutionResult> {
    const startedAt = Date.now();
    try {
      const result = await this.pool.query(request.sql, request.params ?? []);
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? result.rows.length,
        metadata: {
          kind: request.kind,
          durationMs: Date.now() - startedAt
        }
      };
    } catch (error) {
      throw new DatasourceAdapterError(
        `Failed to execute ${request.kind} datasource request: ${getErrorMessage(error)}`,
        request.kind,
        error
      );
    }
  }

  async query(sql: string, params: DatasourceParamValue[] = []): Promise<QueryResultRow[]> {
    const result = await this.execute({ kind: "query", sql, params });
    return result.rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function createPool(config: DbConfig): Pool {
  if (config.url) {
    return new Pool({
      connectionString: config.url,
      ssl: config.ssl ? { rejectUnauthorized: false } : false
    });
  }

  return new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
