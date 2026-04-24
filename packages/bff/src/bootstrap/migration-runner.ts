import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import type { DbConfig } from "../types";

export type MigrationTarget = "meta" | "business" | "audit";

const TARGET_TO_FILE: Record<MigrationTarget, string> = {
  meta: "100_meta_baseline.sql",
  business: "200_business_baseline.sql",
  audit: "300_audit_baseline.sql"
};

export class MigrationRunner {
  constructor(private readonly rootDir: string) {}

  async apply(target: MigrationTarget, config: DbConfig): Promise<void> {
    const sqlFile = resolveBootstrapSqlFile(this.rootDir, target);
    const sql = readFileSync(sqlFile, "utf8");
    const pool = createPool(config);
    try {
      await pool.query(sql);
    } finally {
      await pool.end();
    }
  }
}

export function createPool(config: DbConfig): Pool {
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

function resolveBootstrapSqlFile(rootDir: string, target: MigrationTarget): string {
  const relativeFile = path.join("scripts", "sql", "bootstrap", TARGET_TO_FILE[target]);
  const candidates = [
    path.join(rootDir, relativeFile),
    path.join(rootDir, "packages", "bff", relativeFile),
    path.resolve(rootDir, "..", "..", "packages", "bff", relativeFile)
  ];

  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(`bootstrap sql not found for ${target}: ${candidates.join(", ")}`);
  }

  return match;
}
