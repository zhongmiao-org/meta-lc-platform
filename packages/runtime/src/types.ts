import type {
  RuntimeDependencyTargetKind,
  RuntimeDependencyTargetRef,
  RuntimeRefreshEvent,
  RuntimeRefreshPlan,
  RuntimeActionDefinition,
  RuntimeDatasourceDefinition,
  RuntimeNodeSchema,
  RuntimePageDsl,
  RuntimeTemplateDependency
} from "@zhongmiao/meta-lc-contracts";

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

export interface ParsedRuntimePageDsl extends RuntimePageDsl {
  datasources: ParsedRuntimeDatasourceDefinition[];
  actions: ParsedRuntimeActionDefinition[];
  layoutTree: ParsedRuntimeNodeSchema[];
  stateKeys: string[];
  dependencies: {
    datasources: Record<string, RuntimeTemplateDependency[]>;
    actions: Record<string, RuntimeTemplateDependency[]>;
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
