import type { RuntimeRuleEffectsPlan } from "../interfaces";
import type { RuntimeRefreshEvent } from "../types";

export function createEmptyRuleEffectsPlan(triggeredBy: RuntimeRefreshEvent): RuntimeRuleEffectsPlan {
  return {
    triggeredBy,
    matchedRuleIds: [],
    patchState: {},
    runActionIds: [],
    refreshDatasourceIds: []
  };
}
