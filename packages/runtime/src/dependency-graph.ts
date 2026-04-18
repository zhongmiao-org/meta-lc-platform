import type {
  RuntimeActionStepDefinition,
  RuntimeDependencyTargetRef,
  RuntimeRefreshEvent
} from "@zhongmiao/meta-lc-contracts";
import {
  createRefreshPlan,
  createRuntimeTargetRef,
  getRuntimeTargetRefKey,
  type ParsedRuntimeActionDefinition,
  type ParsedRuntimeDatasourceDefinition,
  type ParsedRuntimePageDsl,
  type PlanRuntimeRefreshResult,
  RuntimeDependencyGraphError,
  type RuntimeDependencyGraph,
  type RuntimeDependencyGraphNode,
  toStableTargetOrder
} from "./types";

export function buildDependencyGraph(parsedDsl: ParsedRuntimePageDsl): RuntimeDependencyGraph {
  const stateKeys = [...parsedDsl.stateKeys];
  const knownStateKeys = new Set(stateKeys);
  const stateToTargets = Object.fromEntries(stateKeys.map((key) => [key, [] as RuntimeDependencyTargetRef[]]));
  const nodes: Record<string, RuntimeDependencyGraphNode> = {};
  const mutationSuccess: Record<string, RuntimeDependencyTargetRef[]> = {};

  const registerNode = (
    ref: RuntimeDependencyTargetRef,
    dependsOnStateKeys: string[],
    outputStateKeys: string[],
    trigger?: string
  ): void => {
    const missingStateKey = dependsOnStateKeys.find((key) => !knownStateKeys.has(key));
    if (missingStateKey) {
      throw new RuntimeDependencyGraphError(`Unknown state dependency "${missingStateKey}" for ${ref.kind} "${ref.id}".`);
    }

    const stableDependsOn = toStableStrings(dependsOnStateKeys);
    const stableOutputs = toStableStrings(outputStateKeys);
    nodes[getRuntimeTargetRefKey(ref)] = {
      ref,
      trigger,
      dependsOnStateKeys: stableDependsOn,
      outputStateKeys: stableOutputs,
      downstream: []
    };

    stableDependsOn.forEach((stateKey) => {
      stateToTargets[stateKey]?.push(ref);
    });
  };

  parsedDsl.datasources.forEach((datasource) => {
    registerNode(
      createRuntimeTargetRef("datasource", datasource.id),
      datasource.dependencies.map((dependency) => dependency.key),
      getDatasourceOutputStateKeys(datasource)
    );
  });

  parsedDsl.actions.forEach((action) => {
    registerNode(
      createRuntimeTargetRef("action", action.id),
      action.dependencies.map((dependency) => dependency.key),
      getActionOutputStateKeys(action),
      action.trigger
    );

    mutationSuccess[action.id] = resolveMutationSuccessTargets(action, parsedDsl);
  });

  Object.values(nodes).forEach((node) => {
    const downstream = new Map<string, RuntimeDependencyTargetRef>();
    node.outputStateKeys.forEach((stateKey) => {
      for (const candidate of stateToTargets[stateKey] ?? []) {
        if (getRuntimeTargetRefKey(candidate) === getRuntimeTargetRefKey(node.ref)) {
          continue;
        }
        const candidateNode = nodes[getRuntimeTargetRefKey(candidate)];
        if (!candidateNode) {
          continue;
        }
        if (candidate.kind === "action" && candidateNode.trigger !== "state.changed") {
          continue;
        }
        downstream.set(getRuntimeTargetRefKey(candidate), candidate);
      }
    });
    node.downstream = toStableTargetOrder([...downstream.values()]);
  });

  Object.values(stateToTargets).forEach((targets) => {
    const stable = toStableTargetOrder(
      targets.filter((target) => {
        if (target.kind === "action") {
          const node = nodes[getRuntimeTargetRefKey(target)];
          return node?.trigger === "state.changed";
        }
        return true;
      })
    );
    targets.splice(0, targets.length, ...stable);
  });

  Object.values(mutationSuccess).forEach((targets) => {
    const stable = toStableTargetOrder(targets);
    targets.splice(0, targets.length, ...stable);
  });

  assertAcyclic(nodes);

  return {
    stateKeys,
    nodes,
    stateToTargets,
    mutationSuccess
  };
}

export function planRefresh(graph: RuntimeDependencyGraph, event: RuntimeRefreshEvent): PlanRuntimeRefreshResult {
  const scheduled = new Map<string, RuntimeDependencyTargetRef>();
  const queue: RuntimeDependencyTargetRef[] = [];

  const enqueue = (ref: RuntimeDependencyTargetRef): void => {
    const key = getRuntimeTargetRefKey(ref);
    if (scheduled.has(key)) {
      return;
    }
    if (!graph.nodes[key]) {
      throw new RuntimeDependencyGraphError(`Unknown refresh target "${key}".`);
    }
    scheduled.set(key, ref);
    queue.push(ref);
  };

  if (event.type === "state.changed") {
    const unknownStateKey = event.stateKeys.find((stateKey) => !graph.stateKeys.includes(stateKey));
    if (unknownStateKey) {
      throw new RuntimeDependencyGraphError(`Unknown state key "${unknownStateKey}" in state.changed event.`);
    }
    for (const stateKey of toStableStrings(event.stateKeys)) {
      for (const ref of graph.stateToTargets[stateKey] ?? []) {
        enqueue(ref);
      }
    }
  } else {
    const rootTargets = graph.mutationSuccess[event.actionId];
    if (!rootTargets) {
      throw new RuntimeDependencyGraphError(
        `Unknown action "${event.actionId}" in mutation.succeeded event.`
      );
    }
    for (const ref of rootTargets) {
      enqueue(ref);
    }
  }

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const node = graph.nodes[getRuntimeTargetRefKey(current)];
    if (!node) {
      continue;
    }
    for (const downstream of node.downstream) {
      enqueue(downstream);
    }
  }

  const targetOrder = topologicallySortTargets(graph, [...scheduled.values()]);
  return createRefreshPlan(event, targetOrder);
}

function resolveMutationSuccessTargets(
  action: ParsedRuntimeActionDefinition,
  parsedDsl: ParsedRuntimePageDsl
): RuntimeDependencyTargetRef[] {
  const refs = new Map<string, RuntimeDependencyTargetRef>();
  const datasourceIds = new Set(parsedDsl.datasources.map((datasource) => datasource.id));
  const actionIds = new Set(parsedDsl.actions.map((candidate) => candidate.id));

  action.onSuccess?.refreshDatasources?.forEach((datasourceId) => {
    if (!datasourceIds.has(datasourceId)) {
      throw new RuntimeDependencyGraphError(
        `Action "${action.id}" references unknown datasource "${datasourceId}" in onSuccess.refreshDatasources.`
      );
    }
    const ref = createRuntimeTargetRef("datasource", datasourceId);
    refs.set(getRuntimeTargetRefKey(ref), ref);
  });

  action.onSuccess?.runActions?.forEach((actionId) => {
    if (!actionIds.has(actionId)) {
      throw new RuntimeDependencyGraphError(
        `Action "${action.id}" references unknown action "${actionId}" in onSuccess.runActions.`
      );
    }
    const ref = createRuntimeTargetRef("action", actionId);
    refs.set(getRuntimeTargetRefKey(ref), ref);
  });

  return [...refs.values()];
}

function getDatasourceOutputStateKeys(datasource: ParsedRuntimeDatasourceDefinition): string[] {
  return datasource.responseMapping?.stateKey ? [datasource.responseMapping.stateKey] : [];
}

function getActionOutputStateKeys(action: ParsedRuntimeActionDefinition): string[] {
  const outputStateKeys = new Set<string>();

  action.steps.forEach((step) => {
    if (step.stateKey?.trim()) {
      outputStateKeys.add(step.stateKey);
    }
    extractPatchStateKeys(step).forEach((stateKey) => outputStateKeys.add(stateKey));
  });

  return [...outputStateKeys].sort((left, right) => left.localeCompare(right));
}

function extractPatchStateKeys(step: RuntimeActionStepDefinition): string[] {
  if (!step.patch) {
    return [];
  }

  return Object.keys(step.patch)
    .map((key) => key.trim())
    .filter((key) => key.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function topologicallySortTargets(
  graph: RuntimeDependencyGraph,
  scheduledTargets: RuntimeDependencyTargetRef[]
): RuntimeDependencyTargetRef[] {
  const scheduledKeys = new Set(scheduledTargets.map((target) => getRuntimeTargetRefKey(target)));
  const indegree = new Map<string, number>();

  scheduledTargets.forEach((target) => {
    indegree.set(getRuntimeTargetRefKey(target), 0);
  });

  scheduledTargets.forEach((target) => {
    const node = graph.nodes[getRuntimeTargetRefKey(target)];
    node?.downstream.forEach((downstream) => {
      const downstreamKey = getRuntimeTargetRefKey(downstream);
      if (!scheduledKeys.has(downstreamKey)) {
        return;
      }
      indegree.set(downstreamKey, (indegree.get(downstreamKey) ?? 0) + 1);
    });
  });

  const ready = scheduledTargets.filter((target) => (indegree.get(getRuntimeTargetRefKey(target)) ?? 0) === 0);
  const ordered: RuntimeDependencyTargetRef[] = [];

  while (ready.length > 0) {
    const [current] = toStableTargetOrder(ready);
    const currentIndex = ready.findIndex(
      (candidate) => getRuntimeTargetRefKey(candidate) === getRuntimeTargetRefKey(current)
    );
    ready.splice(currentIndex, 1);
    if (!current) {
      continue;
    }
    ordered.push(current);

    const node = graph.nodes[getRuntimeTargetRefKey(current)];
    node?.downstream.forEach((downstream) => {
      const downstreamKey = getRuntimeTargetRefKey(downstream);
      if (!scheduledKeys.has(downstreamKey)) {
        return;
      }
      const nextDegree = (indegree.get(downstreamKey) ?? 0) - 1;
      indegree.set(downstreamKey, nextDegree);
      if (nextDegree === 0) {
        ready.push(downstream);
      }
    });
  }

  if (ordered.length !== scheduledTargets.length) {
    throw new RuntimeDependencyGraphError("Runtime refresh plan contains a dependency cycle.");
  }

  return ordered;
}

function assertAcyclic(nodes: Record<string, RuntimeDependencyGraphNode>): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeKey: string, trail: string[]): void => {
    if (visited.has(nodeKey)) {
      return;
    }
    if (visiting.has(nodeKey)) {
      throw new RuntimeDependencyGraphError(
        `Runtime dependency cycle detected: ${[...trail, nodeKey].join(" -> ")}.`
      );
    }

    visiting.add(nodeKey);
    const node = nodes[nodeKey];
    node?.downstream.forEach((downstream) => visit(getRuntimeTargetRefKey(downstream), [...trail, nodeKey]));
    visiting.delete(nodeKey);
    visited.add(nodeKey);
  };

  Object.keys(nodes)
    .sort((left, right) => left.localeCompare(right))
    .forEach((nodeKey) => visit(nodeKey, []));
}

function toStableStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((left, right) =>
    left.localeCompare(right)
  );
}
