import type { MetaRegistryItem } from "../../infra/integration/meta-registry-response.type";

export type { MetaRegistryItem, MetaResourceKind } from "../../infra/integration/meta-registry-response.type";

export type MetaListEnvelope<TItem = Record<string, unknown>> = {
  items: TItem[];
  source: "memory";
  cached: boolean;
  requestId: string;
};

export type MetaSummaryEntry = {
  count: number;
  updatedAt: string | null;
};

export type MetaSummary = Record<string, MetaSummaryEntry>;

export type MetaSummaryEnvelope<TSummary = Record<string, unknown>> = {
  summary: TSummary;
  source: "memory";
  cached: boolean;
  requestId: string;
};
