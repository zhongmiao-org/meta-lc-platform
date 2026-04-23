import {
  type DagDependencyGraph,
  type DagEdges,
  type DagGraphNode,
  DagSchedulerError
} from "../types";

export function buildDagDependencyGraph(edges: DagEdges): DagDependencyGraph {
  const normalizedEdges = normalizeDagEdges(edges);
  const nodes: Record<string, DagGraphNode> = Object.fromEntries(
    Object.keys(normalizedEdges).map((nodeId) => [
      nodeId,
      {
        id: nodeId,
        dependencies: normalizedEdges[nodeId],
        downstream: []
      } satisfies DagGraphNode
    ])
  );

  Object.values(nodes).forEach((node) => {
    node.dependencies.forEach((dependencyId) => {
      nodes[dependencyId]?.downstream.push(node.id);
    });
  });

  Object.values(nodes).forEach((node) => {
    node.downstream = toStableUniqueStrings(node.downstream);
  });

  return { nodes };
}

export function normalizeDagEdges(edges: DagEdges): DagEdges {
  const nodeIds = Object.keys(edges).sort((left, right) => left.localeCompare(right));
  const knownNodeIds = new Set(nodeIds);
  const normalized: DagEdges = {};

  nodeIds.forEach((nodeId) => {
    const dependencies = edges[nodeId];
    if (!Array.isArray(dependencies)) {
      throw new DagSchedulerError(`Dependencies for node "${nodeId}" must be an array.`);
    }

    const stableDependencies = toStableUniqueStrings(dependencies);
    const unknownDependency = stableDependencies.find((dependencyId) => !knownNodeIds.has(dependencyId));
    if (unknownDependency) {
      throw new DagSchedulerError(`Node "${nodeId}" depends on unknown node "${unknownDependency}".`);
    }

    normalized[nodeId] = stableDependencies;
  });

  return normalized;
}

export function toStableUniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((left, right) =>
    left.localeCompare(right)
  );
}
