import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

type DbConfig = {
  url?: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
};

async function main(): Promise<void> {
  const sqlFile = path.resolve(import.meta.dirname, "..", "sql", "001_orders_demo.sql");
  const pool = createPool(loadBusinessDbConfig());
  try {
    await pool.query(readFileSync(sqlFile, "utf8"));
    console.log("seed applied: orders demo");
  } finally {
    await pool.end();
  }
}

function loadBusinessDbConfig(): DbConfig {
  const url = process.env.LC_DB_BUSINESS_URL;
  if (url) {
    return parseDbUrl(url);
  }
  return {
    host: readRequired("LC_DB_HOST"),
    port: readPort(process.env.LC_DB_PORT, 5432),
    user: readRequired("LC_DB_USER"),
    password: readRequired("LC_DB_PASSWORD"),
    database: process.env.LC_DB_BUSINESS_NAME ?? process.env.LC_DB_NAME ?? "business_db",
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
