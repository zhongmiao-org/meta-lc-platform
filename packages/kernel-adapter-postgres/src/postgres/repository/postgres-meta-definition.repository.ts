import type {
  MetaDefinitionKind,
  MetaDefinitionPublishInput,
  MetaDefinitionVersion
} from "@zhongmiao/meta-lc-kernel";
import { mapMetaDefinitionVersionRow } from "../mapper/meta-definition-version.mapper";
import type { MetaDefinitionVersionRow } from "../interfaces/meta-definition-version-row.interface";
import type { createPostgresPool } from "../utils/postgres-pool.util";

type PostgresPool = ReturnType<typeof createPostgresPool>;

export class PostgresMetaDefinitionRepository {
  constructor(private readonly pool: PostgresPool) {}

  async getLatestDefinitionVersion<K extends MetaDefinitionKind>(
    appId: string,
    kind: K,
    id: string
  ): Promise<MetaDefinitionVersion<K> | null> {
    const result = await this.pool.query<MetaDefinitionVersionRow<K>>(
      `SELECT app_id, definition_kind, definition_id, version, definition_json, metadata_json
       FROM meta_kernel_definition_versions
       WHERE app_id = $1 AND definition_kind = $2 AND definition_id = $3
       ORDER BY version DESC
       LIMIT 1`,
      [appId, kind, id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapMetaDefinitionVersionRow<K>(result.rows[0]);
  }

  async getDefinitionVersion<K extends MetaDefinitionKind>(
    appId: string,
    kind: K,
    id: string,
    version: number
  ): Promise<MetaDefinitionVersion<K> | null> {
    const result = await this.pool.query<MetaDefinitionVersionRow<K>>(
      `SELECT app_id, definition_kind, definition_id, version, definition_json, metadata_json
       FROM meta_kernel_definition_versions
       WHERE app_id = $1 AND definition_kind = $2 AND definition_id = $3 AND version = $4
       LIMIT 1`,
      [appId, kind, id, version]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapMetaDefinitionVersionRow<K>(result.rows[0]);
  }

  async listLatestDefinitionVersions<K extends MetaDefinitionKind>(
    appId: string,
    kind: K
  ): Promise<Array<MetaDefinitionVersion<K>>> {
    const result = await this.pool.query<MetaDefinitionVersionRow<K>>(
      `SELECT DISTINCT ON (definition_id)
        app_id,
        definition_kind,
        definition_id,
        version,
        definition_json,
        metadata_json
       FROM meta_kernel_definition_versions
       WHERE app_id = $1 AND definition_kind = $2
       ORDER BY definition_id ASC, version DESC`,
      [appId, kind]
    );

    return result.rows.map(mapMetaDefinitionVersionRow<K>);
  }

  async createDefinitionVersion<K extends MetaDefinitionKind>(
    input: MetaDefinitionPublishInput<K>
  ): Promise<MetaDefinitionVersion<K>> {
    const latest = await this.getLatestDefinitionVersion(input.appId, input.kind, input.id);
    const nextVersion = latest ? latest.version + 1 : 1;
    const metadata = {
      author: input.metadata.author,
      message: input.metadata.message,
      createdAt: new Date().toISOString()
    };

    const result = await this.pool.query<MetaDefinitionVersionRow<K>>(
      `INSERT INTO meta_kernel_definition_versions (
        app_id,
        definition_kind,
        definition_id,
        version,
        definition_json,
        metadata_json
      )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
       RETURNING app_id, definition_kind, definition_id, version, definition_json, metadata_json`,
      [
        input.appId,
        input.kind,
        input.id,
        nextVersion,
        JSON.stringify(input.definition),
        JSON.stringify(metadata)
      ]
    );

    return mapMetaDefinitionVersionRow<K>(result.rows[0]);
  }
}
