import {
  buildRuntimePageTopic,
  type RuntimePageDsl,
  type RuntimePageTopicRef,
  type RuntimeRefreshEvent,
  type RuntimeRefreshPlan
} from "@zhongmiao/meta-lc-contracts";
import { buildDependencyGraph, planRefresh } from "../../domain/graph/runtime-dependency-graph";
import { createFunctionRegistry } from "../function-registry";
import { evaluateRules } from "../rule-engine";
import { parseRuntimePageDsl } from "../../domain/dsl/runtime-dsl-parser";
import type {
  ParsedRuntimePageDsl,
  RuntimeFunctionRegistry,
  RuntimeRuleEffectsPlan
} from "../../types";

export type RuntimeManagerCommand =
  | {
      type: "patchState";
      patch: Record<string, unknown>;
    }
  | {
      type: "refreshDatasource";
      datasourceId: string;
    }
  | {
      type: "runAction";
      actionId: string;
    };

export interface RuntimeOrchestrationRequest {
  dsl: RuntimePageDsl | ParsedRuntimePageDsl;
  state: Record<string, unknown>;
  event: RuntimeRefreshEvent;
  functionRegistry?: RuntimeFunctionRegistry;
  pageInstance?: RuntimePageTopicRef;
}

export interface RuntimeOrchestrationPlan {
  refreshPlan: RuntimeRefreshPlan;
  ruleEffects: RuntimeRuleEffectsPlan;
  nextState: Record<string, unknown>;
  managerCommands: RuntimeManagerCommand[];
  wsTopics: string[];
}

export async function orchestrateRuntimeEvent(
  request: RuntimeOrchestrationRequest
): Promise<RuntimeOrchestrationPlan> {
  const parsedDsl = isParsedRuntimePageDsl(request.dsl) ? request.dsl : parseRuntimePageDsl(request.dsl);
  const graph = buildDependencyGraph(parsedDsl);
  const refreshPlan = planRefresh(graph, request.event);
  const functionRegistry = request.functionRegistry ?? createFunctionRegistry();
  const ruleEffects = await evaluateRules({
    event: request.event,
    state: request.state,
    parsedDsl,
    graph,
    functionRegistry
  });
  const nextState = {
    ...request.state,
    ...ruleEffects.patchState
  };

  return {
    refreshPlan,
    ruleEffects,
    nextState,
    managerCommands: buildManagerCommands(refreshPlan, ruleEffects),
    wsTopics: request.pageInstance ? [buildRuntimePageTopic(request.pageInstance)] : []
  };
}

function buildManagerCommands(
  refreshPlan: RuntimeRefreshPlan,
  ruleEffects: RuntimeRuleEffectsPlan
): RuntimeManagerCommand[] {
  const commands: RuntimeManagerCommand[] = [];
  if (Object.keys(ruleEffects.patchState).length > 0) {
    commands.push({
      type: "patchState",
      patch: ruleEffects.patchState
    });
  }

  for (const datasourceId of mergeStableIds(refreshPlan.datasourceIds, ruleEffects.refreshDatasourceIds)) {
    commands.push({
      type: "refreshDatasource",
      datasourceId
    });
  }

  for (const actionId of mergeStableIds(refreshPlan.actionIds, ruleEffects.runActionIds)) {
    commands.push({
      type: "runAction",
      actionId
    });
  }

  return commands;
}

function mergeStableIds(primary: string[], secondary: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const append = (id: string): void => {
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    result.push(id);
  };

  primary.forEach(append);
  [...secondary].sort((left, right) => left.localeCompare(right)).forEach(append);
  return result;
}

function isParsedRuntimePageDsl(value: RuntimePageDsl | ParsedRuntimePageDsl): value is ParsedRuntimePageDsl {
  return "stateKeys" in value && "dependencies" in value;
}
