import type { MetaSchema, MetaVersion } from "@zhongmiao/meta-lc-kernel";

export interface MetaVersionRow {
  app_id: string;
  version: number;
  schema_json: MetaSchema;
  metadata_json: MetaVersion["metadata"];
}
