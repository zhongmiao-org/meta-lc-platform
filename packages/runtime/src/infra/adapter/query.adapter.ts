import {
  buildSelectQueryAst,
  compileSelectAst,
  compileSelectQuery,
  type CompiledQuery,
  type QueryRequest,
  type SelectQueryAst
} from "@zhongmiao/meta-lc-query";
import {
  transformSelectQueryAstWithPermission,
  type PermissionAstTransformContext
} from "@zhongmiao/meta-lc-permission";
import type {
  DatasourceAdapter,
  DatasourceExecutionResult
} from "@zhongmiao/meta-lc-datasource";

export interface QueryCompilerAdapter {
  buildAst(request: QueryRequest): SelectQueryAst;
  compileAst(ast: SelectQueryAst): CompiledQuery;
  compile(request: QueryRequest): CompiledQuery;
}

export interface QueryPermissionAdapter {
  transform(ast: SelectQueryAst, context: PermissionAstTransformContext): SelectQueryAst;
}

export interface QueryDatasourceAdapter extends DatasourceAdapter {}

export function createQueryCompilerAdapter(
  compile: (request: QueryRequest) => CompiledQuery = compileSelectQuery
): QueryCompilerAdapter {
  return {
    buildAst: buildSelectQueryAst,
    compileAst: compileSelectAst,
    compile
  };
}

export function createQueryPermissionAdapter(
  transform: (ast: SelectQueryAst, context: PermissionAstTransformContext) => SelectQueryAst =
    transformSelectQueryAstWithPermission
): QueryPermissionAdapter {
  return {
    transform
  };
}

export function createQueryDatasourceAdapter(
  datasource: QueryDatasourceAdapter
): QueryDatasourceAdapter {
  return datasource;
}

export type QueryDatasourceExecutionResult = DatasourceExecutionResult;
