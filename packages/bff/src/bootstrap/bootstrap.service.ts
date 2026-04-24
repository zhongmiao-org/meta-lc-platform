import { Logger } from "@nestjs/common";
import {
  isProductionEnv,
  loadBootstrapAdminConfig,
  loadBootstrapMode,
  loadDbTargets
} from "../types/config";
import { createPool, MigrationRunner } from "./migration-runner";

function quoteIdentifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }
  return `"${value}"`;
}

async function tryCreateDatabase(adminConfig: ReturnType<typeof loadBootstrapAdminConfig>, database: string): Promise<void> {
  const pool = createPool(adminConfig);
  try {
    await pool.query(`CREATE DATABASE ${quoteIdentifier(database)};`);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes("already exists")) {
      return;
    }
    if (message.includes("permission denied") || message.includes("must be owner")) {
      throw new Error(`permission denied creating database ${database}`);
    }
    throw error;
  } finally {
    await pool.end();
  }
}

export class BootstrapService {
  private readonly logger = new Logger("DbBootstrap");
  private readonly runner: MigrationRunner;

  constructor(private readonly rootDir: string) {
    this.runner = new MigrationRunner(rootDir);
  }

  async run(options: { failFast: boolean }): Promise<void> {
    const mode = loadBootstrapMode();
    const targets = loadDbTargets();

    if (isProductionEnv() && mode === "auto") {
      throw new Error("LC_DB_BOOTSTRAP_MODE=auto is forbidden in production.");
    }

    const shouldRun = mode === "auto" || options.failFast;
    if (!shouldRun) {
      this.logger.log("bootstrap skipped (manual mode)");
      return;
    }

    try {
      const admin = loadBootstrapAdminConfig();
      await tryCreateDatabase(admin, targets.meta.database);
      await tryCreateDatabase(admin, targets.business.database);
      await tryCreateDatabase(admin, targets.audit.database);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`database creation skipped: ${message}. continue with table bootstrap.`);
      if (options.failFast) {
        throw error;
      }
    }

    try {
      await this.runner.apply("meta", targets.meta);
      await this.runner.apply("business", targets.business);
      await this.runner.apply("audit", targets.audit);
      this.logger.log("database baseline bootstrap completed");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`bootstrap migration failed: ${message}`);
      if (options.failFast) {
        throw error;
      }
    }
  }
}
