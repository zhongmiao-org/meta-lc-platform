export interface QueryApiRequest {
  table: string;
  fields: string[];
  filters?: Record<string, string | number | boolean>;
  tenantId: string;
  userId: string;
  roles: string[];
  limit?: number;
}

export interface QueryApiResponse {
  rows: Record<string, unknown>[];
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

export interface MutationApiResponse {
  rowCount: number;
  row: Record<string, unknown> | null;
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

export interface RuntimePageTopicRef {
  tenantId: string;
  pageId: string;
  pageInstanceId: string;
}

export function buildRuntimePageTopic(ref: RuntimePageTopicRef): string {
  return `tenant.${ref.tenantId}.page.${ref.pageId}.instance.${ref.pageInstanceId}`;
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

export interface RuntimeActionSuccessDefinition {
  refreshDatasources?: string[];
  runActions?: string[];
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
  onSuccess?: RuntimeActionSuccessDefinition;
  steps: RuntimeActionStepDefinition[];
}

export type RuntimeRuleTrigger = "state.changed" | "mutation.succeeded";

export type RuntimeRuleValueSource = "literal" | "state" | "event" | "function";

export interface RuntimeRuleLiteralValueDefinition {
  source: "literal";
  value: unknown;
}

export interface RuntimeRuleStateValueDefinition {
  source: "state";
  key: string;
}

export interface RuntimeRuleEventValueDefinition {
  source: "event";
  key: string;
}

export interface RuntimeFunctionCallDefinition {
  name: string;
  args: RuntimeRuleValueDefinition[];
}

export interface RuntimeRuleFunctionValueDefinition {
  source: "function";
  call: RuntimeFunctionCallDefinition;
}

export type RuntimeRuleValueDefinition =
  | RuntimeRuleLiteralValueDefinition
  | RuntimeRuleStateValueDefinition
  | RuntimeRuleEventValueDefinition
  | RuntimeRuleFunctionValueDefinition;

export interface RuntimeRuleConditionDefinition {
  call: RuntimeFunctionCallDefinition;
}

export interface RuntimeSetStateEffectDefinition {
  type: "setState";
  stateKey: string;
  value: RuntimeRuleValueDefinition;
}

export interface RuntimeRunActionEffectDefinition {
  type: "runAction";
  actionId: string;
}

export interface RuntimeRefreshDatasourceEffectDefinition {
  type: "refreshDatasource";
  datasourceId: string;
}

export type RuntimeRuleEffectDefinition =
  | RuntimeSetStateEffectDefinition
  | RuntimeRunActionEffectDefinition
  | RuntimeRefreshDatasourceEffectDefinition;

export interface RuntimeRuleDefinition {
  id: string;
  trigger: RuntimeRuleTrigger;
  condition: RuntimeRuleConditionDefinition;
  effects: RuntimeRuleEffectDefinition[];
}

export type RuntimeDependencyTargetKind = "datasource" | "action";

export interface RuntimeDependencyTargetRef {
  kind: RuntimeDependencyTargetKind;
  id: string;
}

export interface RuntimeStateChangedEvent {
  type: "state.changed";
  stateKeys: string[];
}

export interface RuntimeMutationSucceededEvent {
  type: "mutation.succeeded";
  actionId: string;
  operation: MutationOperation;
}

export type RuntimeRefreshEvent = RuntimeStateChangedEvent | RuntimeMutationSucceededEvent;

export interface RuntimeRefreshPlan {
  datasourceIds: string[];
  actionIds: string[];
  targetOrder: RuntimeDependencyTargetRef[];
  triggeredBy: RuntimeRefreshEvent;
}

export interface RuntimePageDsl {
  schemaVersion: string;
  pageMeta: RuntimePageMeta;
  state: Record<string, unknown>;
  datasources: RuntimeDatasourceDefinition[];
  actions: RuntimeActionDefinition[];
  rules?: RuntimeRuleDefinition[];
  layoutTree: RuntimeNodeSchema[];
}
