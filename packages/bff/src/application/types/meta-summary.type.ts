import type { MetaResourceKind } from "../../contracts/types/meta-registry.type";

export type MetaSummaryEntry = {
  count: number;
  updatedAt: string | null;
};

export type MetaSummary = Record<MetaResourceKind, MetaSummaryEntry>;
