import { Pool } from "pg";
import type { DbConfig } from "@zhongmiao/meta-lc-kernel";

export function createPostgresPool(config: DbConfig): Pool {
  return new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false
  });
}
