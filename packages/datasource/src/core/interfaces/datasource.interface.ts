import type {
  DatasourceExecutionKind,
  DatasourceParamValue
} from "../types";

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
