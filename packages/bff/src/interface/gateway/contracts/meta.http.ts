export interface MetaRequestLike {
  headers: Record<string, string | string[] | undefined>;
}

export interface MetaResponseLike {
  setHeader(name: string, value: string): void;
}

export interface MetaListEnvelope<TItem = Record<string, unknown>> {
  items: TItem[];
  source: "memory";
  cached: boolean;
  requestId: string;
}

export interface MetaSummaryEnvelope<TSummary = Record<string, unknown>> {
  summary: TSummary;
  source: "memory";
  cached: boolean;
  requestId: string;
}
