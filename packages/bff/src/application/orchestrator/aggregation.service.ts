import { Injectable } from "@nestjs/common";
import { MetaRegistryService } from "../../interface/gateway/meta-registry.service";
import type { MetaResourceKind } from "../../interface/gateway/contracts/meta-registry.contract";

export interface MetaSummaryEntry {
  count: number;
  updatedAt: string | null;
}

export type MetaSummary = Record<MetaResourceKind, MetaSummaryEntry>;

@Injectable()
export class AggregationService {
  constructor(private readonly registry: MetaRegistryService) {}

  summarizeMeta(): MetaSummary {
    return this.registry.listKinds().reduce((summary, kind) => {
      const items = this.registry.list(kind);
      summary[kind] = {
        count: items.length,
        updatedAt: newestUpdatedAt(items.map((item) => item.updatedAt))
      };
      return summary;
    }, {} as MetaSummary);
  }
}

function newestUpdatedAt(values: string[]): string | null {
  if (!values.length) {
    return null;
  }
  return values.sort().at(-1) ?? null;
}
