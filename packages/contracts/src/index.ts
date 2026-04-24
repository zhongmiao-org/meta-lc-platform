export type MutationOperation = "create" | "update" | "delete";

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

export type ViewExpression =
  | string
  | number
  | boolean
  | null
  | ViewExpression[]
  | { [key: string]: ViewExpression };

export type Expression = ViewExpression;

export interface ViewDefinition {
  name: string;
  params?: Record<string, ViewExpression>;
  nodes: Record<string, NodeDefinition>;
  output: OutputDefinition;
  submit?: SubmitDefinition;
}

export type NodeDefinition = QueryNodeDefinition | MutationNodeDefinition | TransformNodeDefinition | MergeNodeDefinition;

export type MergeStrategy = "objectMerge" | "arrayConcat" | "custom";

export interface BaseNodeDefinition {
  type: "query" | "mutation" | "transform" | "merge";
  [key: string]: unknown;
}

export interface QueryNodeDefinition extends BaseNodeDefinition {
  type: "query";
  request?: ViewExpression;
  table?: ViewExpression;
  fields?: ViewExpression[];
  filters?: Record<string, ViewExpression>;
  limit?: ViewExpression;
}

export interface MutationNodeDefinition extends BaseNodeDefinition {
  type: "mutation";
  model?: ViewExpression;
  operation?: ViewExpression;
  payload?: Record<string, ViewExpression>;
  condition?: ViewExpression;
}

export interface TransformNodeDefinition extends BaseNodeDefinition {
  type: "transform";
}

export interface MergeNodeDefinition extends BaseNodeDefinition {
  type: "merge";
  strategy?: MergeStrategy;
  inputs?: Record<string, ViewExpression>;
  hook?: string;
}

export interface OutputDefinition {
  [key: string]: ViewExpression;
}

export interface SubmitDefinition {
  nodes?: string[];
  [key: string]: unknown;
}

export interface ExecutionNode {
  id: string;
  type: NodeDefinition["type"];
  definition: NodeDefinition;
}

export interface ExecutionPlan {
  nodes: ExecutionNode[];
  edges: Record<string, string[]>;
  output: OutputDefinition;
  submit?: SubmitDefinition;
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

export const RUNTIME_MANAGER_EXECUTED_EVENT = "runtimeManagerExecuted";

export type RuntimeManagerExecutedEventType = "runtime.manager.executed";

export interface RuntimeManagerExecutedEvent {
  type: RuntimeManagerExecutedEventType;
  topic: string;
  page: RuntimePageTopicRef;
  requestId?: string;
  replayId?: string;
  patchState: Record<string, unknown>;
  refreshedDatasourceIds: string[];
  runActionIds: string[];
}

export interface CreateRuntimeManagerExecutedEventRequest {
  page: RuntimePageTopicRef;
  requestId?: string;
  patchState?: Record<string, unknown>;
  refreshedDatasourceIds?: string[];
  runActionIds?: string[];
}

export function createRuntimeManagerExecutedEvent(
  request: CreateRuntimeManagerExecutedEventRequest
): RuntimeManagerExecutedEvent {
  return {
    type: "runtime.manager.executed",
    topic: buildRuntimePageTopic(request.page),
    page: { ...request.page },
    ...(request.requestId ? { requestId: request.requestId } : {}),
    patchState: { ...(request.patchState ?? {}) },
    refreshedDatasourceIds: [...(request.refreshedDatasourceIds ?? [])],
    runActionIds: [...(request.runActionIds ?? [])]
  };
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
