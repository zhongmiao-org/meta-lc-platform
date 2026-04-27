import type {
  CompiledQuery,
  QueryRequest,
  SelectQueryAst
} from "@zhongmiao/meta-lc-query";
import type { PermissionAstTransformContext } from "@zhongmiao/meta-lc-permission";
import type { DatasourceAdapter } from "@zhongmiao/meta-lc-datasource";
import type {
  MutationAdapterCommand,
  MutationAdapterResult
} from "./runtime.interface";

export interface QueryCompilerAdapter {
  buildAst(request: QueryRequest): SelectQueryAst;
  compileAst(ast: SelectQueryAst): CompiledQuery;
  compile(request: QueryRequest): CompiledQuery;
}

export interface QueryPermissionAdapter {
  transform(ast: SelectQueryAst, context: PermissionAstTransformContext): SelectQueryAst;
}

export interface QueryDatasourceAdapter extends DatasourceAdapter {}

export interface MutationDatasourceAdapter {
  execute(command: MutationAdapterCommand): Promise<MutationAdapterResult>;
}
