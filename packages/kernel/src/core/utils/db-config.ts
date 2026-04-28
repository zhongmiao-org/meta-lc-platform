import type { DbConfig } from "../interfaces";

function readInt(value: string | undefined, fallback: number): number {
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

export function loadDbConfig(): DbConfig {
  return {
    host: readRequired("LC_DB_HOST"),
    port: readInt(process.env.LC_DB_PORT, 5432),
    user: readRequired("LC_DB_USER"),
    password: readRequired("LC_DB_PASSWORD"),
    database: readRequired("LC_DB_NAME"),
    ssl: (process.env.LC_DB_SSL ?? "false").toLowerCase() === "true"
  };
}
