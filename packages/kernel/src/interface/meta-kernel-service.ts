import { validateSchema } from "../types/contracts";
import { createMigrationSafetyReport } from "../application/migration-safety";
import { PostgresMetaKernelRepository } from "../infra/persistence/postgres-meta-kernel-repository";
import type {
  MetaSchema,
  MetaVersion,
  MigrationExecutionOptions
} from "../types/shared.types";
import { diffSchemas, generateMigrationSql, type SchemaDiff } from "../domain/schema-diff";

type KernelRepository = Pick<
  PostgresMetaKernelRepository,
  "init" | "createVersion" | "getVersion" | "executeMigration"
>;

export interface MigrationExecutionResult {
  fromVersion: number;
  toVersion: number;
  statements: string[];
  applied: boolean;
  destructiveStatements: string[];
  auditCount: number;
}

export class MetaKernelService {
  constructor(private readonly repository: KernelRepository) {}

  async init(): Promise<void> {
    await this.repository.init();
  }

  async publishSchema(input: {
    appId: string;
    schema: MetaSchema;
    author: string;
    message: string;
  }): Promise<MetaVersion> {
    validateSchema(input.schema);
    return this.repository.createVersion({
      appId: input.appId,
      schema: input.schema,
      metadata: {
        author: input.author,
        message: input.message
      }
    });
  }

  async rollback(appId: string, targetVersion: number, author: string): Promise<MetaVersion> {
    const target = await this.repository.getVersion(appId, targetVersion);
    if (!target) {
      throw new Error(`Target version ${targetVersion} not found for app ${appId}.`);
    }

    return this.repository.createVersion({
      appId,
      schema: target.schema,
      metadata: {
        author,
        message: `Rollback to version ${targetVersion}`,
        rollbackFromVersion: targetVersion
      }
    });
  }

  async diff(appId: string, fromVersion: number, toVersion: number): Promise<SchemaDiff> {
    const from = await this.repository.getVersion(appId, fromVersion);
    const to = await this.repository.getVersion(appId, toVersion);
    if (!from || !to) {
      throw new Error("Cannot diff: one of the versions does not exist.");
    }
    return diffSchemas(from.schema, to.schema);
  }

  async buildMigrationPlan(
    appId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<MigrationExecutionResult> {
    const schemaDiff = await this.diff(appId, fromVersion, toVersion);
    const statements = generateMigrationSql(schemaDiff);
    const safetyReport = createMigrationSafetyReport(statements);
    return {
      fromVersion,
      toVersion,
      statements,
      applied: false,
      destructiveStatements: safetyReport.destructiveStatements,
      auditCount: 0
    };
  }

  async migrateToVersion(
    appId: string,
    fromVersion: number,
    toVersion: number,
    options: MigrationExecutionOptions = {}
  ): Promise<MigrationExecutionResult> {
    const plan = await this.buildMigrationPlan(appId, fromVersion, toVersion);
    const result = await this.repository.executeMigration(
      plan.statements,
      {
        allowDestructive: options.allowDestructive,
        destructiveStatementAllowlist: options.destructiveStatementAllowlist
      },
      {
        appId,
        fromVersion,
        toVersion,
        requestId: options.requestId
      }
    );
    return {
      ...plan,
      applied: true,
      auditCount: result.auditCount
    };
  }

  async replayFromVersion(
    appId: string,
    startVersion: number,
    options: MigrationExecutionOptions = {}
  ): Promise<MigrationExecutionResult[]> {
    const current = await this.repository.getVersion(appId, startVersion);
    if (!current) {
      throw new Error(`Start version ${startVersion} not found for app ${appId}.`);
    }

    const results: MigrationExecutionResult[] = [];
    let cursor = startVersion;

    while (true) {
      const next = await this.repository.getVersion(appId, cursor + 1);
      if (!next) {
        break;
      }

      const result = await this.migrateToVersion(appId, cursor, cursor + 1, options);
      results.push(result);
      cursor += 1;
    }

    return results;
  }
}
