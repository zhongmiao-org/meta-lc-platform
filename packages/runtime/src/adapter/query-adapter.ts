import {
  compileSelectQuery,
  type CompiledQuery,
  type QueryRequest
} from "@zhongmiao/meta-lc-query";
import type { QueryResultRow } from "@zhongmiao/meta-lc-datasource";

export interface QueryCompilerAdapter {
  compile(request: QueryRequest): CompiledQuery;
}

export interface QueryDatasourceAdapter {
  query(sql: string, params?: Array<string | number | boolean>): Promise<QueryResultRow[]>;
}

export function createQueryCompilerAdapter(
  compile: (request: QueryRequest) => CompiledQuery = compileSelectQuery
): QueryCompilerAdapter {
  return {
    compile
  };
}

export function createQueryDatasourceAdapter(
  datasource: QueryDatasourceAdapter
): QueryDatasourceAdapter {
  return datasource;
}
