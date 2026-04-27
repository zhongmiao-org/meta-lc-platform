import type {
  MetaRegistryItem,
  MetaResourceKind
} from "./meta-registry-response.type";

export interface MetaRegistryProvider {
  list(kind: MetaResourceKind): Promise<MetaRegistryItem[]>;
  listKinds(): MetaResourceKind[];
}
