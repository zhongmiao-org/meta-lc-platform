import type { RuntimeDependencyTargetRef } from "../interfaces";
import type { RuntimeDependencyTargetKind } from "../types";

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
