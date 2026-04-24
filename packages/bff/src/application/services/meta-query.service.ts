import { Injectable } from "@nestjs/common";
import { CacheService } from "../../infra/cache/cache.service";
import { AggregationService } from "./aggregation.service";
import { MetaRegistryService } from "./meta-registry.service";
import type { MetaListEnvelope, MetaSummaryEnvelope } from "../../contracts/types/meta-http.type";
import type {
  MetaRegistryItem,
  MetaResourceKind
} from "../../contracts/types/meta-registry.type";
import type { MetaSummary } from "../types/meta-summary.type";

@Injectable()
export class MetaQueryService {
  constructor(
    private readonly registry: MetaRegistryService,
    private readonly cache: CacheService,
    private readonly aggregation: AggregationService
  ) {}

  async list(kind: MetaResourceKind, requestId: string): Promise<MetaListEnvelope<MetaRegistryItem>> {
    const result = await this.cache.remember<MetaRegistryItem[]>(`meta:${kind}`, () => this.registry.list(kind));
    return {
      items: result.value,
      source: "memory",
      cached: result.cached,
      requestId
    };
  }

  async summary(requestId: string): Promise<MetaSummaryEnvelope<MetaSummary>> {
    const result = await this.cache.remember<MetaSummary>("meta:summary", () => this.aggregation.summarizeMeta());
    return {
      summary: result.value,
      source: "memory",
      cached: result.cached,
      requestId
    };
  }
}
