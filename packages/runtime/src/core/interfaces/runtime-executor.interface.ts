import type { RuntimeAuditObserver } from "@zhongmiao/meta-lc-audit";
import type { NodeExecutorDependencies } from "./node-executor.interface";
import type {
  ParsedRuntimePageDsl,
  RuntimeFunctionRegistry,
  RuntimePageDsl,
  RuntimePageTopicRef,
  RuntimeRefreshPlan,
  RuntimeRuleEffectsPlan
} from "./runtime.interface";
import type {
  RuntimeManagerCommand,
  RuntimeRefreshEvent
} from "../types";

export interface RuntimeExecutorDependencies {
  executors: NodeExecutorDependencies;
  auditObserver?: RuntimeAuditObserver;
}

export interface RuntimeManagerEventRequest {
  dsl: RuntimePageDsl | ParsedRuntimePageDsl;
  state: Record<string, unknown>;
  event: RuntimeRefreshEvent;
  functionRegistry?: RuntimeFunctionRegistry;
  pageInstance?: RuntimePageTopicRef;
}

export interface RuntimeManagerPlan {
  refreshPlan: RuntimeRefreshPlan;
  ruleEffects: RuntimeRuleEffectsPlan;
  nextState: Record<string, unknown>;
  managerCommands: RuntimeManagerCommand[];
  wsTopics: string[];
}
