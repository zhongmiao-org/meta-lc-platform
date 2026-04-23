import {
  type DagCycleResult,
  type DagEdges,
  DagSchedulerError
} from "../../types";
import { buildDagDependencyGraph } from "./dependency-graph";

export function topoSort(edges: DagEdges): string[] {
  const graph = buildDagDependencyGraph(edges);
  const cycle = detectCycle(edges);
  if (cycle) {
    throw new DagSchedulerError(`DAG cycle detected: ${cycle.path.join(" -> ")}.`);
  }

  const indegree = Object.fromEntries(Object.keys(graph.nodes).map((nodeId) => [nodeId, 0]));
  Object.values(graph.nodes).forEach((node) => {
    node.downstream.forEach((downstreamId) => {
      indegree[downstreamId] = (indegree[downstreamId] ?? 0) + 1;
    });
  });

  const ready = Object.keys(indegree)
    .filter((nodeId) => indegree[nodeId] === 0)
    .sort((left, right) => left.localeCompare(right));
  const ordered: string[] = [];

  while (ready.length > 0) {
    const current = ready.shift();
    if (!current) {
      continue;
    }
    ordered.push(current);

    graph.nodes[current]?.downstream.forEach((downstreamId) => {
      indegree[downstreamId] = (indegree[downstreamId] ?? 0) - 1;
      if (indegree[downstreamId] === 0) {
        ready.push(downstreamId);
        ready.sort((left, right) => left.localeCompare(right));
      }
    });
  }

  return ordered;
}

export function detectCycle(edges: DagEdges): DagCycleResult | null {
  const graph = buildDagDependencyGraph(edges);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string, trail: string[]): DagCycleResult | null => {
    if (visited.has(nodeId)) {
      return null;
    }
    const activeIndex = trail.indexOf(nodeId);
    if (activeIndex >= 0) {
      return {
        path: [...trail.slice(activeIndex), nodeId]
      };
    }

    visiting.add(nodeId);
    const nextTrail = [...trail, nodeId];
    const dependencies = graph.nodes[nodeId]?.dependencies ?? [];
    for (const dependencyId of dependencies) {
      const cycle = visit(dependencyId, nextTrail);
      if (cycle) {
        return cycle;
      }
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return null;
  };

  for (const nodeId of Object.keys(graph.nodes).sort((left, right) => left.localeCompare(right))) {
    if (visiting.has(nodeId)) {
      continue;
    }
    const cycle = visit(nodeId, []);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}
