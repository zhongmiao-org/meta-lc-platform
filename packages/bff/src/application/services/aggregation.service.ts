import { Injectable } from "@nestjs/common";
import { MetaRegistryService } from "./meta-registry.service";
import type { MetaSummary } from "../types/meta-summary.type";

@Injectable()
export class AggregationService {
  constructor(private readonly registry: MetaRegistryService) {}

  async summarizeMeta(): Promise<MetaSummary> {
    const summary = {} as MetaSummary;
    for (const kind of this.registry.listKinds()) {
      const items = await this.registry.list(kind);
      summary[kind] = {
        count: items.length,
        updatedAt: newestUpdatedAt(items.map((item) => item.updatedAt))
      };
    }
    return summary;
  }
}

function newestUpdatedAt(values: string[]): string | null {
  if (!values.length) {
    return null;
  }
  return values.sort().at(-1) ?? null;
}
