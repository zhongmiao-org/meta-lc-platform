import { Pool } from "pg";
import type { DbConfig, QueryResultRow } from "../../types/shared.types";

export class PostgresDatasourceAdapter {
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

  async healthCheck(): Promise<boolean> {
    const result = await this.pool.query("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  }

  async query(sql: string, params: Array<string | number | boolean> = []): Promise<QueryResultRow[]> {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
