import type { BootstrapMode, DbConfig, DbTargets } from "./shared.types";

function toPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
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

function fromLegacyDatabase(nameEnv: string): DbConfig {
  return {
    host: readRequired("LC_DB_HOST"),
    port: toPort(process.env.LC_DB_PORT, 5432),
    user: readRequired("LC_DB_USER"),
    password: readRequired("LC_DB_PASSWORD"),
    database: process.env[nameEnv] ?? readRequired("LC_DB_NAME"),
    ssl: (process.env.LC_DB_SSL ?? "false").toLowerCase() === "true"
  };
}

function loadDbConfigFrom(
  urlEnv: string,
  fallbackDatabaseEnv: string
): DbConfig {
  const url = process.env[urlEnv];
  if (url) {
    return parseDbUrl(url);
  }
  return fromLegacyDatabase(fallbackDatabaseEnv);
}

export function loadDbTargets(): DbTargets {
  return {
    meta: loadDbConfigFrom("LC_DB_META_URL", "LC_DB_META_NAME"),
    business: loadDbConfigFrom("LC_DB_BUSINESS_URL", "LC_DB_BUSINESS_NAME"),
    audit: loadDbConfigFrom("LC_DB_AUDIT_URL", "LC_DB_AUDIT_NAME")
  };
}

export function loadDbConfig(): DbConfig {
  return loadDbTargets().business;
}

export function loadBootstrapMode(): BootstrapMode {
  const value = (process.env.LC_DB_BOOTSTRAP_MODE ?? "manual").toLowerCase();
  return value === "auto" ? "auto" : "manual";
}

export function isProductionEnv(): boolean {
  return (process.env.NODE_ENV ?? "").toLowerCase() === "production";
}

export function shouldAutoBootstrap(): boolean {
  return !isProductionEnv() && loadBootstrapMode() === "auto";
}

export function loadBootstrapAdminConfig(): DbConfig {
  const explicitUrl = process.env.LC_DB_BOOTSTRAP_URL;
  if (explicitUrl) {
    return parseDbUrl(explicitUrl);
  }

  const business = loadDbTargets().business;
  return {
    ...business,
    database: "postgres"
  };
}
