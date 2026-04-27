import type { MetaDefinitionVersion } from "./kernel.interface";
import type { MetaDefinitionKind } from "../types";

export interface InMemoryMetaDefinitionSeed<K extends MetaDefinitionKind = MetaDefinitionKind> {
  appId: string;
  kind: K;
  id: string;
  definition: MetaDefinitionVersion<K>["definition"];
  version?: number;
  metadata?: Partial<MetaDefinitionVersion<K>["metadata"]>;
}
