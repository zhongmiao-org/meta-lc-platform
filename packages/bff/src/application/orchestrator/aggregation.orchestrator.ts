import { Injectable } from "@nestjs/common";
import { MetaRegistryService } from "../services/meta-registry.service";
import type { MetaSummary } from "../types/meta-summary.type";

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
