import type {
  MetaDefinitionPublishInput,
  MetaDefinitionVersion,
  MetaSchema,
  MetaVersion
} from "../../core/interfaces";
import type { MetaDefinitionKind } from "../../core/types";

export interface InMemoryMetaDefinitionSeed<K extends MetaDefinitionKind = MetaDefinitionKind> {
  appId: string;
  kind: K;
  id: string;
  definition: MetaDefinitionVersion<K>["definition"];
  version?: number;
  metadata?: Partial<MetaDefinitionVersion<K>["metadata"]>;
}

export class InMemoryMetaKernelRepository {
  private readonly schemaVersions = new Map<string, MetaVersion[]>();
  private readonly definitionVersions = new Map<string, Array<MetaDefinitionVersion<MetaDefinitionKind>>>();

  constructor(seed: { definitions?: InMemoryMetaDefinitionSeed[] } = {}) {
    for (const definition of seed.definitions ?? []) {
      this.seedDefinition(definition);
    }
  }

  async init(): Promise<void> {}

  async createVersion(input: {
    appId: string;
    schema: MetaSchema;
    metadata: { author: string; message: string; rollbackFromVersion?: number | null };
  }): Promise<MetaVersion> {
    const versions = this.schemaVersions.get(input.appId) ?? [];
    const version: MetaVersion = {
      appId: input.appId,
      version: versions.length ? Math.max(...versions.map((item) => item.version)) + 1 : 1,
      schema: structuredClone(input.schema),
      metadata: {
        author: input.metadata.author,
        message: input.metadata.message,
        createdAt: new Date().toISOString(),
        rollbackFromVersion: input.metadata.rollbackFromVersion ?? null
      }
    };
    versions.push(version);
    this.schemaVersions.set(input.appId, versions);
    return structuredClone(version);
  }

  async getVersion(appId: string, version: number): Promise<MetaVersion | null> {
    const item = this.schemaVersions.get(appId)?.find((candidate) => candidate.version === version);
    return item ? structuredClone(item) : null;
  }

  async executeMigration(): Promise<{ auditCount: number }> {
    return { auditCount: 0 };
  }

  async createDefinitionVersion<K extends MetaDefinitionKind>(
    input: MetaDefinitionPublishInput<K>
  ): Promise<MetaDefinitionVersion<K>> {
    const versions = this.getDefinitionVersions(input.appId, input.kind, input.id);
    const version: MetaDefinitionVersion<K> = {
      appId: input.appId,
      kind: input.kind,
      id: input.id,
      version: versions.length ? Math.max(...versions.map((item) => item.version)) + 1 : 1,
      definition: structuredClone(input.definition),
      metadata: {
        author: input.metadata.author,
        message: input.metadata.message,
        createdAt: new Date().toISOString()
      }
    };
    this.storeDefinition(version);
    return structuredClone(version);
  }

  async getLatestDefinitionVersion<K extends MetaDefinitionKind>(
    appId: string,
    kind: K,
    id: string
  ): Promise<MetaDefinitionVersion<K> | null> {
    const versions = this.getDefinitionVersions(appId, kind, id);
    const latest = versions.sort((left, right) => right.version - left.version)[0];
    return latest ? structuredClone(latest) : null;
  }

  async getDefinitionVersion<K extends MetaDefinitionKind>(
    appId: string,
    kind: K,
    id: string,
    version: number
  ): Promise<MetaDefinitionVersion<K> | null> {
    const item = this.getDefinitionVersions(appId, kind, id).find((candidate) => candidate.version === version);
    return item ? structuredClone(item) : null;
  }

  async listLatestDefinitionVersions<K extends MetaDefinitionKind>(
    appId: string,
    kind: K
  ): Promise<Array<MetaDefinitionVersion<K>>> {
    const byId = new Map<string, MetaDefinitionVersion<K>>();
    for (const item of this.definitionVersions.get(appId) ?? []) {
      if (item.kind !== kind) {
        continue;
      }
      const current = byId.get(item.id);
      if (!current || item.version > current.version) {
        byId.set(item.id, item as MetaDefinitionVersion<K>);
      }
    }

    return [...byId.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item) => structuredClone(item));
  }

  private seedDefinition<K extends MetaDefinitionKind>(seed: InMemoryMetaDefinitionSeed<K>): void {
    this.storeDefinition({
      appId: seed.appId,
      kind: seed.kind,
      id: seed.id,
      version: seed.version ?? 1,
      definition: structuredClone(seed.definition),
      metadata: {
        author: seed.metadata?.author ?? "system",
        message: seed.metadata?.message ?? "Seed definition",
        createdAt: seed.metadata?.createdAt ?? new Date().toISOString()
      }
    });
  }

  private storeDefinition<K extends MetaDefinitionKind>(version: MetaDefinitionVersion<K>): void {
    const versions = this.definitionVersions.get(version.appId) ?? [];
    versions.push(version as MetaDefinitionVersion<MetaDefinitionKind>);
    this.definitionVersions.set(version.appId, versions);
  }

  private getDefinitionVersions<K extends MetaDefinitionKind>(
    appId: string,
    kind: K,
    id: string
  ): Array<MetaDefinitionVersion<K>> {
    return (this.definitionVersions.get(appId) ?? []).filter(
      (item): item is MetaDefinitionVersion<K> => item.kind === kind && item.id === id
    );
  }
}
