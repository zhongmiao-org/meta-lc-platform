import type { QueryResultRow } from "@zhongmiao/meta-lc-datasource";
import type {
  NodeDefinition,
  OutputDefinition,
  SubmitDefinition
} from "@zhongmiao/meta-lc-kernel";
import type {
  MutationOperation,
  RuntimeContext,
  RuntimeDependencyTargetKind,
  RuntimeFunctionHandler,
  RuntimeManagerExecutedEventType,
  RuntimeNodeResult,
  RuntimeRefreshEvent,
  RuntimeRuleTrigger,
  RuntimeRuleEffectDefinition,
  RuntimeRuleValueDefinition,
  RuntimeTemplateSource
} from "../types";

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

export interface RuntimeRuleDefinition {
  id: string;
  trigger: RuntimeRuleTrigger;
  condition: RuntimeRuleConditionDefinition;
  effects: RuntimeRuleEffectDefinition[];
}

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

export interface ExpressionStateGetter {
  get(path: string): unknown;
}

export interface RuntimeStateStore {
  get(path: string): unknown;
}

export interface RuntimeQueryNodeResult {
  rows: QueryResultRow[];
  row: QueryResultRow | null;
}

export interface RuntimeValueNodeResult {
  value: unknown;
}

export interface RuntimeExecutionResult {
  viewModel: Record<string, unknown>;
  state: Record<string, unknown>;
  nodeResults: Record<string, RuntimeNodeResult>;
  layers: string[][];
}

export interface DagGraphNode {
  id: string;
  dependencies: string[];
  downstream: string[];
}

export interface DagDependencyGraph {
  nodes: Record<string, DagGraphNode>;
}

export interface DagCycleResult {
  path: string[];
}

export interface ViewCompilerDependency {
  nodeId: string;
  expression: string;
}

export interface ParsedRuntimeDatasourceDefinition extends RuntimeDatasourceDefinition {
  dependencies: RuntimeTemplateDependency[];
}

export interface ParsedRuntimeActionDefinition extends RuntimeActionDefinition {
  dependencies: RuntimeTemplateDependency[];
  outputStateKeys: string[];
}

export interface MutationExecutionResult {
  skipped: boolean;
  model: string;
  operation: MutationOperation;
  payload: Record<string, unknown>;
  rowCount: number;
  row: Record<string, unknown> | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  condition: boolean | null;
}

export interface MutationAdapterCommand {
  model: string;
  operation: MutationOperation;
  payload: Record<string, unknown>;
  context: RuntimeContext;
}

export interface MutationAdapterResult {
  rowCount: number;
  row: Record<string, unknown> | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
}

export interface ParsedRuntimeNodeSchema extends RuntimeNodeSchema {
  dependencies: RuntimeTemplateDependency[];
  children?: ParsedRuntimeNodeSchema[];
}

export interface ParsedRuntimeRuleDefinition extends RuntimeRuleDefinition {
  stateDependencies: string[];
}

export interface ParsedRuntimePageDsl extends RuntimePageDsl {
  datasources: ParsedRuntimeDatasourceDefinition[];
  actions: ParsedRuntimeActionDefinition[];
  rules: ParsedRuntimeRuleDefinition[];
  layoutTree: ParsedRuntimeNodeSchema[];
  stateKeys: string[];
  dependencies: {
    datasources: Record<string, RuntimeTemplateDependency[]>;
    actions: Record<string, RuntimeTemplateDependency[]>;
    rules: Record<string, string[]>;
    layoutNodes: Record<string, RuntimeTemplateDependency[]>;
  };
}

export interface RuntimeDependencyGraphNode {
  ref: RuntimeDependencyTargetRef;
  trigger?: string;
  dependsOnStateKeys: string[];
  outputStateKeys: string[];
  downstream: RuntimeDependencyTargetRef[];
}

export interface RuntimeDependencyGraph {
  stateKeys: string[];
  nodes: Record<string, RuntimeDependencyGraphNode>;
  stateToTargets: Record<string, RuntimeDependencyTargetRef[]>;
  mutationSuccess: Record<string, RuntimeDependencyTargetRef[]>;
}

export interface RuntimeDslValidationIssue {
  path: string;
  message: string;
}

export interface PlanRuntimeRefreshResult extends RuntimeRefreshPlan {}

export interface RuntimeFunctionExecutionContext {
  state: Record<string, unknown>;
  event: RuntimeRefreshEvent;
  parsedDsl: ParsedRuntimePageDsl;
  graph: RuntimeDependencyGraph;
}

export interface RuntimeFunctionRegistry {
  register(name: string, handler: RuntimeFunctionHandler): void;
  exec(name: string, args: unknown[], context: RuntimeFunctionExecutionContext): Promise<unknown>;
}

export interface RuntimeRuleEffectsPlan {
  triggeredBy: RuntimeRefreshEvent;
  matchedRuleIds: string[];
  patchState: Record<string, unknown>;
  runActionIds: string[];
  refreshDatasourceIds: string[];
}

export interface RuntimeRuleEvaluationContext extends RuntimeFunctionExecutionContext {
  functionRegistry: RuntimeFunctionRegistry;
}

export interface RuntimeRuleEvaluationRequest {
  event: RuntimeRefreshEvent;
  state: Record<string, unknown>;
  parsedDsl: ParsedRuntimePageDsl;
  graph: RuntimeDependencyGraph;
  functionRegistry: RuntimeFunctionRegistry;
}
