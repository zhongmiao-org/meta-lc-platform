import {
  type DagEdges,
  DagSchedulerError
} from "../../core/types";
import { buildDagDependencyGraph } from "./dependency-graph";
import { detectCycle } from "./topo-sort";

export function resolveExecutionOrder(edges: DagEdges): string[][] {
  const graph = buildDagDependencyGraph(edges);
  const cycle = detectCycle(edges);
  if (cycle) {
    throw new DagSchedulerError(`DAG cycle detected: ${cycle.path.join(" -> ")}.`);
  }

  const remainingDependencies = Object.fromEntries(
    Object.values(graph.nodes).map((node) => [node.id, new Set(node.dependencies)])
  );
  const resolved = new Set<string>();
  const layers: string[][] = [];

  while (resolved.size < Object.keys(graph.nodes).length) {
    const layer = Object.keys(graph.nodes)
      .filter((nodeId) => !resolved.has(nodeId))
      .filter((nodeId) => [...(remainingDependencies[nodeId] ?? [])].every((dependencyId) => resolved.has(dependencyId)))
      .sort((left, right) => left.localeCompare(right));

    if (layer.length === 0) {
      throw new DagSchedulerError("Unable to resolve DAG execution order.");
    }

    layer.forEach((nodeId) => resolved.add(nodeId));
    layers.push(layer);
  }

  return layers;
}
