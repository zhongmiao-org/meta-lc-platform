import type {
  DbConfig,
  PostgresOrgScopeData
} from "@zhongmiao/meta-lc-datasource";
import type { RuntimeAuditObserver } from "@zhongmiao/meta-lc-audit";
import type { OrgScopeContext } from "@zhongmiao/meta-lc-permission";
import type { MetaKernelService } from "@zhongmiao/meta-lc-kernel";
import type { MergeExecutorDependencies } from "./merge-executor.interface";
import type {
  QueryCompilerAdapter,
  QueryDatasourceAdapter,
  QueryPermissionAdapter,
  MutationDatasourceAdapter
} from "./runtime-adapter.interface";

export interface RuntimeGatewayViewRequest {
  tenantId: string;
  userId: string;
  roles: string[];
  input?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface RuntimeGatewayViewOptions {
  appId?: string;
  metaKernel?: Pick<MetaKernelService, "getViewDefinition">;
  queryDatasource?: QueryDatasourceAdapter & ClosableResource;
  mutationDatasource?: MutationDatasourceAdapter & ClosableResource;
  orgScopeResolver?: RuntimeOrgScopeResolver & ClosableResource;
  auditObserver?: RuntimeAuditObserver & ClosableResource;
  businessDbConfig?: DbConfig;
}

export interface RuntimeOrgScopeResolver {
  resolve(input: { tenantId: string; userId: string; roles: string[] }): Promise<OrgScopeContext>;
}

export interface RuntimeViewExecutorDependencies {
  queryCompiler?: QueryCompilerAdapter;
  queryPermission?: QueryPermissionAdapter;
  queryDatasource: QueryDatasourceAdapter;
  mutationDatasource?: MutationDatasourceAdapter;
  merge?: MergeExecutorDependencies;
  auditObserver?: RuntimeAuditObserver;
}

export interface RuntimePostgresOrgScopeResolver {
  resolve(input: { tenantId: string; userId: string }): Promise<PostgresOrgScopeData>;
  close(): Promise<void>;
}

export interface ClosableResource {
  close?(): Promise<void>;
}
