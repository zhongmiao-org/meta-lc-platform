import type {
  MetaDefinitionKind,
  MetaDefinitionVersion
} from "@zhongmiao/meta-lc-kernel";
import type { MetaDefinitionVersionRow } from "../interfaces/meta-definition-version-row.interface";

export function mapMetaDefinitionVersionRow<K extends MetaDefinitionKind>(
  row: MetaDefinitionVersionRow<K>
): MetaDefinitionVersion<K> {
  return {
    appId: row.app_id,
    kind: row.definition_kind,
    id: row.definition_id,
    version: row.version,
    definition: row.definition_json,
    metadata: row.metadata_json
  };
}
