import { Inject, Injectable, Optional } from "@nestjs/common";
import { BFF_META_REGISTRY_PROVIDER } from "../../common/constants/gateway-provider.constant";
import type {
  MetaRegistryItem,
  MetaRegistryProvider,
  MetaResourceKind
} from "./meta-registry.type";

const META_RESOURCE_KINDS: MetaResourceKind[] = ["tables", "pages", "datasources", "rules", "permissions"];

@Injectable()
export class MetaRegistryService {
  constructor(
    @Optional()
    @Inject(BFF_META_REGISTRY_PROVIDER)
    private readonly provider: MetaRegistryProvider = createEmptyMetaRegistryProvider()
  ) {}

  list(kind: MetaResourceKind): Promise<MetaRegistryItem[]> {
    return this.provider.list(kind);
  }

  listKinds(): MetaResourceKind[] {
    return this.provider.listKinds();
  }
}

export function createEmptyMetaRegistryProvider(): MetaRegistryProvider {
  return {
    async list() {
      return [];
    },
    listKinds() {
      return [...META_RESOURCE_KINDS];
    }
  };
}
