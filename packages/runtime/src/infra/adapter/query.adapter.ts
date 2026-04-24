import {
  compileSelectQuery,
  type CompiledQuery,
  type QueryRequest
} from "@zhongmiao/meta-lc-query";
import type {
  DatasourceAdapter,
  DatasourceExecutionResult
} from "@zhongmiao/meta-lc-datasource";

export interface QueryCompilerAdapter {
  compile(request: QueryRequest): CompiledQuery;
}

export interface QueryDatasourceAdapter extends DatasourceAdapter {}

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

export type QueryDatasourceExecutionResult = DatasourceExecutionResult;
