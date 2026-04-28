import type {
  CompiledQuery,
  QueryRequest
} from "@zhongmiao/meta-lc-query";
import type {
  QueryResultRow
} from "@zhongmiao/meta-lc-datasource";
import type { RuntimeAuditObserver } from "@zhongmiao/meta-lc-audit";
import type {
  QueryCompilerAdapter,
  QueryDatasourceAdapter,
  QueryPermissionAdapter
} from "./runtime-adapter.interface";

export interface QueryAuditDependencies {
  observer?: RuntimeAuditObserver;
  nodeId?: string;
  nodeType?: string;
}

export interface QueryExecutorDependencies {
  compiler?: QueryCompilerAdapter;
  permission?: QueryPermissionAdapter;
  datasource: QueryDatasourceAdapter;
  audit?: QueryAuditDependencies;
}

export interface QueryExecutionResult {
  rows: QueryResultRow[];
  query: CompiledQuery;
  request: QueryRequest;
}
