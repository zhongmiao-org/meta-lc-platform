import type { DatasourceExecutionKind } from "../types";

export class DatasourceAdapterError extends Error {
  constructor(
    message: string,
    public readonly kind: DatasourceExecutionKind,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "DatasourceAdapterError";
  }
}
