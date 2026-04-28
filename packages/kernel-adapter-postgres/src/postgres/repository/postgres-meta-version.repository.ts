import type { MetaSchema, MetaVersion } from "@zhongmiao/meta-lc-kernel";
import { mapMetaVersionRow } from "../mapper/meta-version.mapper";
import type { MetaVersionRow } from "../interfaces/meta-version-row.interface";
import type { createPostgresPool } from "../utils/postgres-pool.util";

type PostgresPool = ReturnType<typeof createPostgresPool>;

export class PostgresMetaVersionRepository {
  constructor(private readonly pool: PostgresPool) {}

  async getLatestVersion(appId: string): Promise<MetaVersion | null> {
    const result = await this.pool.query<MetaVersionRow>(
      `SELECT app_id, version, schema_json, metadata_json
       FROM meta_kernel_versions
       WHERE app_id = $1
       ORDER BY version DESC
       LIMIT 1`,
      [appId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapMetaVersionRow(result.rows[0]);
  }

  async getVersion(appId: string, version: number): Promise<MetaVersion | null> {
    const result = await this.pool.query<MetaVersionRow>(
      `SELECT app_id, version, schema_json, metadata_json
       FROM meta_kernel_versions
       WHERE app_id = $1 AND version = $2
       LIMIT 1`,
      [appId, version]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapMetaVersionRow(result.rows[0]);
  }

  async listVersions(appId: string): Promise<MetaVersion[]> {
    const result = await this.pool.query<MetaVersionRow>(
      `SELECT app_id, version, schema_json, metadata_json
       FROM meta_kernel_versions
       WHERE app_id = $1
       ORDER BY version ASC`,
      [appId]
    );

    return result.rows.map(mapMetaVersionRow);
  }

  async createVersion(input: {
    appId: string;
    schema: MetaSchema;
    metadata: { author: string; message: string; rollbackFromVersion?: number | null };
  }): Promise<MetaVersion> {
    const latest = await this.getLatestVersion(input.appId);
    const nextVersion = latest ? latest.version + 1 : 1;
    const metadata = {
      author: input.metadata.author,
      message: input.metadata.message,
      createdAt: new Date().toISOString(),
      rollbackFromVersion: input.metadata.rollbackFromVersion ?? null
    };

    const result = await this.pool.query<MetaVersionRow>(
      `INSERT INTO meta_kernel_versions (app_id, version, schema_json, metadata_json)
       VALUES ($1, $2, $3::jsonb, $4::jsonb)
       RETURNING app_id, version, schema_json, metadata_json`,
      [input.appId, nextVersion, JSON.stringify(input.schema), JSON.stringify(metadata)]
    );

    return mapMetaVersionRow(result.rows[0]);
  }
}
