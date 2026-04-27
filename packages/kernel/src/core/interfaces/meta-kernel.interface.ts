import type { MigrationGuardOptions } from "./migration-safety.interface";
import type {
  MetaDefinitionPublishInput,
  MetaDefinitionVersion,
  MetaSchema,
  MetaVersion
} from "./kernel.interface";
import type {
  MetaDefinitionKind,
} from "../types";

export interface MetaKernelMigrationExecutionContext {
  appId: string;
  fromVersion: number;
  toVersion: number;
  requestId?: string;
}

export interface MetaKernelRepositoryPort {
  init(): Promise<void>;
  createVersion(input: {
    appId: string;
    schema: MetaSchema;
    metadata: { author: string; message: string; rollbackFromVersion?: number | null };
  }): Promise<MetaVersion>;
  getVersion(appId: string, version: number): Promise<MetaVersion | null>;
  executeMigration(
    statements: string[],
    options?: MigrationGuardOptions,
    context?: MetaKernelMigrationExecutionContext
  ): Promise<{ auditCount: number }>;
  createDefinitionVersion<K extends MetaDefinitionKind>(
    input: MetaDefinitionPublishInput<K>
  ): Promise<MetaDefinitionVersion<K>>;
  getDefinitionVersion<K extends MetaDefinitionKind>(
    appId: string,
    kind: K,
    id: string,
    version: number
  ): Promise<MetaDefinitionVersion<K> | null>;
  getLatestDefinitionVersion<K extends MetaDefinitionKind>(
    appId: string,
    kind: K,
    id: string
  ): Promise<MetaDefinitionVersion<K> | null>;
  listLatestDefinitionVersions<K extends MetaDefinitionKind>(
    appId: string,
    kind: K
  ): Promise<Array<MetaDefinitionVersion<K>>>;
}

export interface MigrationExecutionResult {
  fromVersion: number;
  toVersion: number;
  statements: string[];
  applied: boolean;
  destructiveStatements: string[];
  auditCount: number;
}
