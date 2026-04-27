import type {
  RuntimeRuleEffectDefinition,
  RuntimeRuleValueDefinition
} from "../../core/types";
import {
  createEmptyRuleEffectsPlan,
  isSupportedRuleTrigger,
  RuntimeRuleEngineError,
  type RuntimeRuleEffectsPlan,
  type RuntimeRuleEvaluationContext,
  type RuntimeRuleEvaluationRequest
} from "../../core/types";

export async function evaluateRules(request: RuntimeRuleEvaluationRequest): Promise<RuntimeRuleEffectsPlan> {
  const evaluationContext: RuntimeRuleEvaluationContext = {
    state: request.state,
    event: request.event,
    parsedDsl: request.parsedDsl,
    graph: request.graph,
    functionRegistry: request.functionRegistry
  };

  const plan = createEmptyRuleEffectsPlan(request.event);
  const actionIds = new Set(request.parsedDsl.actions.map((action) => action.id));
  const datasourceIds = new Set(request.parsedDsl.datasources.map((datasource) => datasource.id));
  const stateKeys = new Set(request.parsedDsl.stateKeys);

  for (const rule of request.parsedDsl.rules) {
    if (!isSupportedRuleTrigger(rule.trigger)) {
      throw new RuntimeRuleEngineError(`Unsupported rule trigger "${rule.trigger}" for rule "${rule.id}".`);
    }
    if (rule.trigger !== request.event.type) {
      continue;
    }
    if (request.event.type === "state.changed" && rule.stateDependencies.length > 0) {
      const stateChangedEvent = request.event;
      const intersects = rule.stateDependencies.some((stateKey) => stateChangedEvent.stateKeys.includes(stateKey));
      if (!intersects) {
        continue;
      }
    }

    const conditionResult = await resolveFunctionCall(rule.condition.call, evaluationContext);
    if (!conditionResult) {
      continue;
    }

    plan.matchedRuleIds.push(rule.id);
    for (const effect of rule.effects) {
      await applyRuleEffect(effect, {
        plan,
        actionIds,
        datasourceIds,
        stateKeys,
        evaluationContext
      });
    }
  }

  plan.runActionIds.sort((left, right) => left.localeCompare(right));
  plan.refreshDatasourceIds.sort((left, right) => left.localeCompare(right));
  return plan;
}

async function applyRuleEffect(
  effect: RuntimeRuleEffectDefinition,
  context: {
    plan: RuntimeRuleEffectsPlan;
    actionIds: Set<string>;
    datasourceIds: Set<string>;
    stateKeys: Set<string>;
    evaluationContext: RuntimeRuleEvaluationContext;
  }
): Promise<void> {
  switch (effect.type) {
    case "setState": {
      if (!context.stateKeys.has(effect.stateKey)) {
        throw new RuntimeRuleEngineError(`Rule effect references unknown state key "${effect.stateKey}".`);
      }
      context.plan.patchState[effect.stateKey] = await resolveRuleValue(effect.value, context.evaluationContext);
      return;
    }
    case "runAction": {
      if (!context.actionIds.has(effect.actionId)) {
        throw new RuntimeRuleEngineError(`Rule effect references unknown action "${effect.actionId}".`);
      }
      if (!context.plan.runActionIds.includes(effect.actionId)) {
        context.plan.runActionIds.push(effect.actionId);
      }
      return;
    }
    case "refreshDatasource": {
      if (!context.datasourceIds.has(effect.datasourceId)) {
        throw new RuntimeRuleEngineError(`Rule effect references unknown datasource "${effect.datasourceId}".`);
      }
      if (!context.plan.refreshDatasourceIds.includes(effect.datasourceId)) {
        context.plan.refreshDatasourceIds.push(effect.datasourceId);
      }
      return;
    }
  }
}

async function resolveRuleValue(
  value: RuntimeRuleValueDefinition,
  context: RuntimeRuleEvaluationContext
): Promise<unknown> {
  switch (value.source) {
    case "literal":
      return value.value;
    case "state":
      if (!(value.key in context.state)) {
        throw new RuntimeRuleEngineError(`Rule value references unknown state key "${value.key}".`);
      }
      return context.state[value.key];
    case "event":
      if (!(value.key in context.event)) {
        throw new RuntimeRuleEngineError(`Rule value references unknown event key "${value.key}".`);
      }
      return context.event[value.key as keyof typeof context.event];
    case "function":
      return resolveFunctionCall(value.call, context);
  }
}

async function resolveFunctionCall(
  call: { name: string; args: RuntimeRuleValueDefinition[] },
  context: RuntimeRuleEvaluationContext
): Promise<unknown> {
  const resolvedArgs = await Promise.all(call.args.map((argument) => resolveRuleValue(argument, context)));
  return context.functionRegistry.exec(call.name, resolvedArgs, context);
}
