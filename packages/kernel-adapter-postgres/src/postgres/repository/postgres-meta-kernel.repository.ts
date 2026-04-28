import type {
  DbConfig,
  MetaDefinitionKind,
  MetaDefinitionPublishInput,
  MetaDefinitionVersion,
  MetaSchema,
  MetaVersion,
  MigrationAuditRecord,
  MigrationGuardOptions
} from "@zhongmiao/meta-lc-kernel";
import { PostgresMetaVersionRepository } from "./postgres-meta-version.repository";
import { PostgresMetaDefinitionRepository } from "./postgres-meta-definition.repository";
import { PostgresMigrationAuditRepository } from "./postgres-migration-audit.repository";
import { META_KERNEL_SCHEMA_SQL } from "../schema/postgres-meta-kernel.schema";
import { createPostgresPool } from "../utils/postgres-pool.util";
import type { MigrationExecutionContext } from "../interfaces/migration-execution-context.interface";

type PostgresPool = ReturnType<typeof createPostgresPool>;

export class PostgresMetaKernelRepository {
  private readonly pool: PostgresPool;
  private readonly metaVersionRepository: PostgresMetaVersionRepository;
  private readonly metaDefinitionRepository: PostgresMetaDefinitionRepository;
  private readonly migrationAuditRepository: PostgresMigrationAuditRepository;

  constructor(config: DbConfig) {
    this.pool = createPostgresPool(config);
    this.metaVersionRepository = new PostgresMetaVersionRepository(this.pool);
    this.metaDefinitionRepository = new PostgresMetaDefinitionRepository(this.pool);
    this.migrationAuditRepository = new PostgresMigrationAuditRepository(this.pool);
  }

  async init(): Promise<void> {
    for (const statement of META_KERNEL_SCHEMA_SQL) {
      await this.pool.query(statement);
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async getLatestVersion(appId: string): Promise<MetaVersion | null> {
    return this.metaVersionRepository.getLatestVersion(appId);
  }

  async getVersion(appId: string, version: number): Promise<MetaVersion | null> {
    return this.metaVersionRepository.getVersion(appId, version);
  }

  async listVersions(appId: string): Promise<MetaVersion[]> {
    return this.metaVersionRepository.listVersions(appId);
  }

  async createVersion(input: {
    appId: string;
    schema: MetaSchema;
    metadata: { author: string; message: string; rollbackFromVersion?: number | null };
  }): Promise<MetaVersion> {
    return this.metaVersionRepository.createVersion(input);
  }

  async getLatestDefinitionVersion<K extends MetaDefinitionKind>(
    appId: string,
    kind: K,
    id: string
  ): Promise<MetaDefinitionVersion<K> | null> {
    return this.metaDefinitionRepository.getLatestDefinitionVersion(appId, kind, id);
  }

  async getDefinitionVersion<K extends MetaDefinitionKind>(
    appId: string,
    kind: K,
    id: string,
    version: number
  ): Promise<MetaDefinitionVersion<K> | null> {
    return this.metaDefinitionRepository.getDefinitionVersion(appId, kind, id, version);
  }

  async listLatestDefinitionVersions<K extends MetaDefinitionKind>(
    appId: string,
    kind: K
  ): Promise<Array<MetaDefinitionVersion<K>>> {
    return this.metaDefinitionRepository.listLatestDefinitionVersions(appId, kind);
  }

  async createDefinitionVersion<K extends MetaDefinitionKind>(
    input: MetaDefinitionPublishInput<K>
  ): Promise<MetaDefinitionVersion<K>> {
    return this.metaDefinitionRepository.createDefinitionVersion(input);
  }

  async executeMigration(
    statements: string[],
    options: MigrationGuardOptions = {},
    context?: MigrationExecutionContext
  ): Promise<{ auditCount: number }> {
    return this.migrationAuditRepository.executeMigration(statements, options, context);
  }

  async listMigrationAudits(requestId: string): Promise<MigrationAuditRecord[]> {
    return this.migrationAuditRepository.listMigrationAudits(requestId);
  }
}
