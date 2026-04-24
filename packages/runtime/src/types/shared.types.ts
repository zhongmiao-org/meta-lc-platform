import type {
  RuntimeDependencyTargetKind,
  RuntimeDependencyTargetRef,
  RuntimeFunctionCallDefinition,
  RuntimeRuleDefinition,
  RuntimeRuleTrigger,
  RuntimeRuleValueDefinition,
  RuntimeRefreshEvent,
  RuntimeRefreshPlan,
  RuntimeActionDefinition,
  RuntimeDatasourceDefinition,
  RuntimeNodeSchema,
  RuntimePageDsl,
  RuntimeTemplateDependency
} from "@zhongmiao/meta-lc-contracts";
import type { QueryResultRow } from "@zhongmiao/meta-lc-datasource";

export type ViewExpression =
  | string
  | number
  | boolean
  | null
  | ViewExpression[]
  | { [key: string]: ViewExpression };

export type Expression = ViewExpression;

export interface ExpressionStateGetter {
  get(path: string): unknown;
}

export type ExpressionStateSource = Record<string, unknown> | Map<string, unknown> | ExpressionStateGetter;

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

export type RuntimeContext = Record<string, unknown>;

export interface RuntimeStateStore {
  get(path: string): unknown;
}

export type RuntimeExecutionStage = "schedule" | "execute" | "output";

export interface RuntimeQueryNodeResult {
  rows: QueryResultRow[];
  row: QueryResultRow | null;
}

export interface RuntimeValueNodeResult {
  value: unknown;
}

export type RuntimeNodeResult = RuntimeQueryNodeResult | RuntimeValueNodeResult;

export interface RuntimeExecutionResult {
  viewModel: Record<string, unknown>;
  state: Record<string, unknown>;
  nodeResults: Record<string, RuntimeNodeResult>;
  layers: string[][];
}

export class RuntimeExecutionError extends Error {
  constructor(
    message: string,
    public readonly stage: RuntimeExecutionStage,
    public readonly cause?: unknown,
    public readonly nodeId?: string,
    public readonly nodeType?: ExecutionNode["type"]
  ) {
    super(message);
    this.name = "RuntimeExecutionError";
  }
}

export type DagEdges = Record<string, string[]>;

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

export class ViewCompilerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewCompilerError";
  }
}

export class DagSchedulerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DagSchedulerError";
  }
}

export class ExpressionResolverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionResolverError";
  }
}

export class NodeExecutorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeExecutorError";
  }
}

export class QueryExecutorError extends NodeExecutorError {
  constructor(
    message: string,
    public readonly stage: "validation" | "compile" | "execute",
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "QueryExecutorError";
  }
}

export class MergeExecutorError extends NodeExecutorError {
  constructor(
    message: string,
    public readonly strategy?: MergeStrategy,
    public readonly hook?: string
  ) {
    super(message);
    this.name = "MergeExecutorError";
  }
}

export interface ParsedRuntimeDatasourceDefinition extends RuntimeDatasourceDefinition {
  dependencies: RuntimeTemplateDependency[];
}

export interface ParsedRuntimeActionDefinition extends RuntimeActionDefinition {
  dependencies: RuntimeTemplateDependency[];
  outputStateKeys: string[];
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

export class RuntimeDslParseError extends Error {
  constructor(public readonly issues: RuntimeDslValidationIssue[]) {
    super(
      `Invalid runtime DSL: ${issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`
    );
    this.name = "RuntimeDslParseError";
  }
}

export class RuntimeDependencyGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeDependencyGraphError";
  }
}

export class RuntimeFunctionRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeFunctionRegistryError";
  }
}

export class RuntimeRuleEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeRuleEngineError";
  }
}

export interface PlanRuntimeRefreshResult extends RuntimeRefreshPlan {}

export function createRuntimeTargetRef(kind: RuntimeDependencyTargetKind, id: string): RuntimeDependencyTargetRef {
  return { kind, id };
}

export function getRuntimeTargetRefKey(ref: RuntimeDependencyTargetRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function toStableTargetOrder(refs: RuntimeDependencyTargetRef[]): RuntimeDependencyTargetRef[] {
  const kindPriority: Record<RuntimeDependencyTargetKind, number> = {
    datasource: 0,
    action: 1
  };

  return [...refs].sort((left, right) => {
    if (left.kind !== right.kind) {
      return kindPriority[left.kind] - kindPriority[right.kind];
    }
    return left.id.localeCompare(right.id);
  });
}

export function createRefreshPlan(
  triggeredBy: RuntimeRefreshEvent,
  targetOrder: RuntimeDependencyTargetRef[]
): PlanRuntimeRefreshResult {
  return {
    triggeredBy,
    targetOrder,
    datasourceIds: targetOrder.filter((ref) => ref.kind === "datasource").map((ref) => ref.id),
    actionIds: targetOrder.filter((ref) => ref.kind === "action").map((ref) => ref.id)
  };
}

export interface RuntimeFunctionExecutionContext {
  state: Record<string, unknown>;
  event: RuntimeRefreshEvent;
  parsedDsl: ParsedRuntimePageDsl;
  graph: RuntimeDependencyGraph;
}

export type RuntimeFunctionHandler = (
  args: unknown[],
  context: RuntimeFunctionExecutionContext
) => unknown | Promise<unknown>;

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

export function createEmptyRuleEffectsPlan(triggeredBy: RuntimeRefreshEvent): RuntimeRuleEffectsPlan {
  return {
    triggeredBy,
    matchedRuleIds: [],
    patchState: {},
    runActionIds: [],
    refreshDatasourceIds: []
  };
}

export function isSupportedRuleTrigger(value: string): value is RuntimeRuleTrigger {
  return value === "state.changed" || value === "mutation.succeeded";
}

export function collectRuleStateDependencies(value: RuntimeRuleValueDefinition | RuntimeFunctionCallDefinition): string[] {
  const keys = new Set<string>();
  const visitValue = (current: RuntimeRuleValueDefinition): void => {
    if (current.source === "state") {
      keys.add(current.key);
      return;
    }
    if (current.source === "function") {
      current.call.args.forEach((argument) => visitValue(argument));
    }
  };
  const visitCall = (call: RuntimeFunctionCallDefinition): void => {
    call.args.forEach((argument) => visitValue(argument));
  };

  if ("name" in value) {
    visitCall(value);
  } else {
    visitValue(value);
  }

  return [...keys].sort((left, right) => left.localeCompare(right));
}
