export interface MetaRequestLike {
  headers: Record<string, string | string[] | undefined>;
}

export interface MetaResponseLike {
  setHeader(name: string, value: string): void;
}
