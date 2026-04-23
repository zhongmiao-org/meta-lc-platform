export interface QueryRequest {
  table: string;
  fields: string[];
  filters?: Record<string, string | number | boolean>;
  limit?: number;
}

export interface CompiledQuery {
  sql: string;
  params: Array<string | number | boolean>;
}
