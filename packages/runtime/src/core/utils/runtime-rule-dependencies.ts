import type { RuntimeFunctionCallDefinition } from "../interfaces";
import type {
  RuntimeRuleTrigger,
  RuntimeRuleValueDefinition
} from "../types";

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
