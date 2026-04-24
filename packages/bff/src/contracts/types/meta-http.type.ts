export type MetaListEnvelope<TItem = Record<string, unknown>> = {
  items: TItem[];
  source: "memory";
  cached: boolean;
  requestId: string;
};

export type MetaSummaryEnvelope<TSummary = Record<string, unknown>> = {
  summary: TSummary;
  source: "memory";
  cached: boolean;
  requestId: string;
};
