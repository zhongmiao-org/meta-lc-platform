export interface DbConfig {
  url?: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

export interface QueryResultRow {
  [key: string]: unknown;
}

export type DatasourceParamValue = string | number | boolean | string[] | null;

export type DatasourceExecutionKind = "query" | "mutation";

export interface DatasourceExecutionRequest {
  kind: DatasourceExecutionKind;
  sql: string;
  params?: DatasourceParamValue[];
}

export interface DatasourceExecutionMetadata {
  kind: DatasourceExecutionKind;
  durationMs: number;
}

export interface DatasourceExecutionResult {
  rows: QueryResultRow[];
  rowCount: number;
  metadata: DatasourceExecutionMetadata;
}

export interface DatasourceAdapter {
  execute(request: DatasourceExecutionRequest): Promise<DatasourceExecutionResult>;
}

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
