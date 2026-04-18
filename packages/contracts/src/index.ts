export interface QueryApiRequest {
  table: string;
  fields: string[];
  filters?: Record<string, string | number | boolean>;
  tenantId: string;
  userId: string;
  roles: string[];
  limit?: number;
}

export type MutationOperation = "create" | "update" | "delete";

export interface MutationApiRequest {
  table: string;
  operation: MutationOperation;
  tenantId: string;
  userId: string;
  roles: string[];
  orgId?: string;
  key?: Record<string, string | number | boolean>;
  data?: Record<string, string | number | boolean | null>;
}

export type DataScopeType =
  | "SELF"
  | "DEPT"
  | "DEPT_AND_CHILDREN"
  | "CUSTOM_ORG_SET"
  | "TENANT_ALL";

export interface RoleDataPolicy {
  role: string;
  scope: DataScopeType;
  customOrgIds?: string[];
}

export interface OrgNode {
  id: string;
  tenantId: string;
  parentId: string | null;
  path: string;
  name: string;
  type: string;
}

export interface OrgScopeContext {
  tenantId: string;
  userId: string;
  roles: string[];
  userOrgIds: string[];
  rolePolicies: RoleDataPolicy[];
  orgNodes: OrgNode[];
}

export interface DataScopeDecision {
  scope: DataScopeType;
  allowedOrgIds: string[];
  tenantAll: boolean;
  legacyFallbackToCreatedBy: boolean;
  reason: string;
}

export interface DbConfig {
  url?: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

export interface DbTargets {
  meta: DbConfig;
  business: DbConfig;
  audit: DbConfig;
}

export type BootstrapMode = "auto" | "manual";

export type AuditStatus = "success" | "failure" | "blocked";

export interface QueryAuditLog {
  requestId: string;
  tenantId: string;
  userId: string;
  queryDsl: string;
  finalSql: string;
  durationMs: number;
  resultCount: number;
  status: AuditStatus;
  errorMessage?: string | null;
}

export type RuntimeTemplateSource = "state";

export interface RuntimeTemplateDependency {
  source: RuntimeTemplateSource;
  key: string;
  expression: string;
}

export interface RuntimePageMeta {
  id: string;
  title: string;
  description?: string;
}

export interface RuntimeNodeSchema {
  id: string;
  componentType: string;
  props: Record<string, unknown>;
  children?: RuntimeNodeSchema[];
}

export interface RuntimeDatasourceDefinition {
  id: string;
  type: string;
  request?: {
    method?: string;
    url?: string;
    params?: Record<string, unknown>;
    body?: unknown;
  };
  responseMapping?: {
    stateKey?: string;
  };
}

export interface RuntimeActionStepDefinition {
  type: string;
  datasourceId?: string;
  stateKey?: string;
  patch?: Record<string, unknown>;
  message?: string;
  payloadTemplate?: Record<string, unknown>;
}

export interface RuntimeActionDefinition {
  id: string;
  trigger?: string;
  steps: RuntimeActionStepDefinition[];
}

export interface RuntimePageDsl {
  schemaVersion: string;
  pageMeta: RuntimePageMeta;
  state: Record<string, unknown>;
  datasources: RuntimeDatasourceDefinition[];
  actions: RuntimeActionDefinition[];
  layoutTree: RuntimeNodeSchema[];
}
