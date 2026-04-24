export interface ViewRequestLike {
  headers: Record<string, string | string[] | undefined>;
}

export interface ViewResponseLike {
  setHeader(name: string, value: string): void;
}
