import type {
  PlanRuntimeRefreshResult,
  RuntimeDependencyTargetRef
} from "../interfaces";
import type { RuntimeRefreshEvent } from "../types";

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
