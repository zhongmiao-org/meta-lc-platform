import type { ViewExpression } from "@zhongmiao/meta-lc-kernel";
import type {
  ExpressionStateGetter,
  RuntimeFunctionExecutionContext,
  RuntimeMutationSucceededEvent,
  RuntimeQueryNodeResult,
  RuntimeRuleEventValueDefinition,
  RuntimeRefreshDatasourceEffectDefinition,
  RuntimeRunActionEffectDefinition,
  RuntimeRuleFunctionValueDefinition,
  RuntimeRuleLiteralValueDefinition,
  RuntimeRuleStateValueDefinition,
  RuntimeSetStateEffectDefinition,
  RuntimeStateChangedEvent,
  RuntimeValueNodeResult
} from "../interfaces";

export type {
  RuntimeAuditEvent,
  RuntimeAuditObserver
} from "@zhongmiao/meta-lc-audit";

export type MutationOperation = "create" | "update" | "delete";

export type Expression = ViewExpression;

export type RuntimeTemplateSource = "state";

export type RuntimeManagerExecutedEventType = "runtime.manager.executed";

export type RuntimeRuleTrigger = "state.changed" | "mutation.succeeded";

export type RuntimeRuleValueSource = "literal" | "state" | "event" | "function";

export type RuntimeRuleValueDefinition =
  | RuntimeRuleLiteralValueDefinition
  | RuntimeRuleStateValueDefinition
  | RuntimeRuleEventValueDefinition
  | RuntimeRuleFunctionValueDefinition;

export type RuntimeRuleEffectDefinition =
  | RuntimeSetStateEffectDefinition
  | RuntimeRunActionEffectDefinition
  | RuntimeRefreshDatasourceEffectDefinition;

export type RuntimeDependencyTargetKind = "datasource" | "action";

export type RuntimeRefreshEvent = RuntimeStateChangedEvent | RuntimeMutationSucceededEvent;

export type ExpressionStateSource = Record<string, unknown> | Map<string, unknown> | ExpressionStateGetter;

export type RuntimeContext = Record<string, unknown>;

export type RuntimeExecutionStage = "schedule" | "execute" | "output";

export type RuntimeNodeResult = RuntimeQueryNodeResult | RuntimeValueNodeResult;

export type DagEdges = Record<string, string[]>;

export type RuntimeFunctionHandler = (
  args: unknown[],
  context: RuntimeFunctionExecutionContext
) => unknown | Promise<unknown>;
