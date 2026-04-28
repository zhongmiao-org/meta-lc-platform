import type {
  MetaDefinitionKind,
  MetaDefinitionVersion
} from "@zhongmiao/meta-lc-kernel";

export interface MetaDefinitionVersionRow<K extends MetaDefinitionKind = MetaDefinitionKind> {
  app_id: string;
  definition_kind: K;
  definition_id: string;
  version: number;
  definition_json: MetaDefinitionVersion<K>["definition"];
  metadata_json: MetaDefinitionVersion<K>["metadata"];
}
