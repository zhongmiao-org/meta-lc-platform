import { createMigrationSafetyReport } from "../../domain/migration-safety";
import { diffMetaDefinitions, validateMetaDefinition } from "../../domain/meta-definition-registry";
import { diffSchemas, generateMigrationSql, type SchemaDiff } from "../../domain/schema-diff";
import type {
  MetaKernelRepositoryPort,
  MigrationExecutionResult
} from "../../core/interfaces";
import { validateSchema } from "../../core/utils";
import type {
  DatasourceDefinition,
  MetaDefinitionDiff,
  MetaDefinitionKind,
  MetaDefinitionPublishInput,
  MetaDefinitionVersion,
  MetaSchema,
  MetaVersion,
  MigrationExecutionOptions,
  PermissionPolicy,
  ViewDefinition
} from "../../core/types/shared.types";

export class MetaKernelService {
  constructor(private readonly repository: MetaKernelRepositoryPort) {}

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

  async publishViewDefinition(input: {
    appId: string;
    id?: string;
    definition: ViewDefinition;
    author: string;
    message: string;
  }): Promise<MetaDefinitionVersion<"view">> {
    return this.publishDefinition({
      appId: input.appId,
      kind: "view",
      id: input.id ?? input.definition.name,
      definition: input.definition,
      metadata: {
        author: input.author,
        message: input.message
      }
    });
  }

  async getViewDefinition(
    appId: string,
    id: string,
    version?: number
  ): Promise<MetaDefinitionVersion<"view"> | null> {
    return this.getDefinition(appId, "view", id, version);
  }

  async publishDatasourceDefinition(input: {
    appId: string;
    definition: DatasourceDefinition;
    author: string;
    message: string;
  }): Promise<MetaDefinitionVersion<"datasource">> {
    return this.publishDefinition({
      appId: input.appId,
      kind: "datasource",
      id: input.definition.id,
      definition: input.definition,
      metadata: {
        author: input.author,
        message: input.message
      }
    });
  }

  async getDatasourceDefinition(
    appId: string,
    id: string,
    version?: number
  ): Promise<MetaDefinitionVersion<"datasource"> | null> {
    return this.getDefinition(appId, "datasource", id, version);
  }

  async publishPermissionPolicy(input: {
    appId: string;
    definition: PermissionPolicy;
    author: string;
    message: string;
  }): Promise<MetaDefinitionVersion<"permissionPolicy">> {
    return this.publishDefinition({
      appId: input.appId,
      kind: "permissionPolicy",
      id: input.definition.id,
      definition: input.definition,
      metadata: {
        author: input.author,
        message: input.message
      }
    });
  }

  async getPermissionPolicy(
    appId: string,
    id: string,
    version?: number
  ): Promise<MetaDefinitionVersion<"permissionPolicy"> | null> {
    return this.getDefinition(appId, "permissionPolicy", id, version);
  }

  async listLatestDefinitions<K extends MetaDefinitionKind>(
    appId: string,
    kind: K
  ): Promise<Array<MetaDefinitionVersion<K>>> {
    return this.repository.listLatestDefinitionVersions(appId, kind);
  }

  async diffDefinition(input: {
    appId: string;
    kind: MetaDefinitionKind;
    id: string;
    fromVersion: number;
    toVersion: number;
  }): Promise<MetaDefinitionDiff> {
    const from = await this.repository.getDefinitionVersion(
      input.appId,
      input.kind,
      input.id,
      input.fromVersion
    );
    const to = await this.repository.getDefinitionVersion(
      input.appId,
      input.kind,
      input.id,
      input.toVersion
    );
    if (!from || !to) {
      throw new Error("Cannot diff definition: one of the versions does not exist.");
    }

    return diffMetaDefinitions({
      appId: input.appId,
      kind: input.kind,
      id: input.id,
      fromVersion: input.fromVersion,
      toVersion: input.toVersion,
      fromDefinition: from.definition,
      toDefinition: to.definition
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

  private async publishDefinition<K extends MetaDefinitionKind>(
    input: MetaDefinitionPublishInput<K>
  ): Promise<MetaDefinitionVersion<K>> {
    validateMetaDefinition(input.kind, input.definition);
    return this.repository.createDefinitionVersion(input);
  }

  private async getDefinition<K extends MetaDefinitionKind>(
    appId: string,
    kind: K,
    id: string,
    version?: number
  ): Promise<MetaDefinitionVersion<K> | null> {
    if (version === undefined) {
      return this.repository.getLatestDefinitionVersion(appId, kind, id);
    }
    return this.repository.getDefinitionVersion(appId, kind, id, version);
  }
}
