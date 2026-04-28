import type { MetaVersion } from "@zhongmiao/meta-lc-kernel";
import type { MetaVersionRow } from "../interfaces/meta-version-row.interface";

export function mapMetaVersionRow(row: MetaVersionRow): MetaVersion {
  return {
    appId: row.app_id,
    version: row.version,
    schema: row.schema_json,
    metadata: row.metadata_json
  };
}
