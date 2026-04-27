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
  QueryCompilerAdapter,
  QueryDatasourceAdapter,
  QueryPermissionAdapter
} from "../../core/interfaces";

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
