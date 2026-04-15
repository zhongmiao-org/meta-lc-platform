import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { loadDbConfig } from "../config";

@Injectable()
export class PostgresQueryExecutorService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const config = loadDbConfig();
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false
    });
  }

  async query(sql: string, params: Array<string | number | boolean>): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async health(): Promise<boolean> {
    const result = await this.pool.query("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
