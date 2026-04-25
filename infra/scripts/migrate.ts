import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

type MigrationTarget = "meta" | "business" | "audit";

type DbConfig = {
  url?: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
};

const TARGET_TO_FILE: Record<MigrationTarget, string> = {
  meta: "100_meta_baseline.sql",
  business: "200_business_baseline.sql",
  audit: "300_audit_baseline.sql"
};

async function main(): Promise<void> {
  const target = readTarget(process.argv[2]);
  const rootDir = path.resolve(import.meta.dirname, "..", "..");
  const sqlFile = resolveBootstrapSqlFile(rootDir, target);
  const pool = createPool(loadDbConfig(target));
  try {
    await pool.query(readFileSync(sqlFile, "utf8"));
    console.log(`migration applied: ${target}`);
  } finally {
    await pool.end();
  }
}

function readTarget(value: string | undefined): MigrationTarget {
  if (value === "meta" || value === "business" || value === "audit") {
    return value;
  }
  throw new Error('Usage: node --experimental-strip-types infra/scripts/migrate.ts <meta|business|audit>');
}

function resolveBootstrapSqlFile(rootDir: string, target: MigrationTarget): string {
  const sqlFile = path.join(rootDir, "sql", "bootstrap", TARGET_TO_FILE[target]);
  if (!existsSync(sqlFile)) {
    throw new Error(`bootstrap sql not found for ${target}: ${sqlFile}`);
  }
  return sqlFile;
}

function loadDbConfig(target: MigrationTarget): DbConfig {
  const prefix = target.toUpperCase();
  const url = process.env[`LC_DB_${prefix}_URL`];
  if (url) {
    return parseDbUrl(url);
  }
  return {
    host: readRequired("LC_DB_HOST"),
    port: readPort(process.env.LC_DB_PORT, 5432),
    user: readRequired("LC_DB_USER"),
    password: readRequired("LC_DB_PASSWORD"),
    database: process.env[`LC_DB_${prefix}_NAME`] ?? process.env.LC_DB_NAME ?? `${target}_db`,
    ssl: (process.env.LC_DB_SSL ?? "false").toLowerCase() === "true"
  };
}

function parseDbUrl(value: string): DbConfig {
  const url = new URL(value);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`Unsupported database url protocol: ${url.protocol}`);
  }
  return {
    url: value,
    host: url.hostname,
    port: Number(url.port || "5432"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ssl: (url.searchParams.get("sslmode") ?? "").toLowerCase() === "require"
  };
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

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function readPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
