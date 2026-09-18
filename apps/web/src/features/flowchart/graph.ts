import type { FlowEdge, FlowGraph, FlowNode, NodeKind } from './types';

export const KIND_LABEL: Record<NodeKind, string> = {
  terminal_start: 'Start',
  terminal_end: 'End',
  process: 'Step',
  decision: 'Decision',
  note: 'Note',
};

/**
 * Structural checks the renderer relies on (the backend verifier owns the full V-F2 set).
 * Returns a list of problems; empty means the graph is safe to lay out and describe.
 */
export function findGraphProblems(graph: FlowGraph): string[] {
  const problems: string[] = [];
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return ['The flowchart data is missing its nodes or edges.'];
  }
  if (graph.nodes.length === 0) return ['The flowchart has no nodes.'];

  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) problems.push(`Node id ${node.id} appears more than once.`);
    nodeIds.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) problems.push(`Edge id ${edge.id} appears more than once.`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      problems.push(`Edge ${edge.id} points to a node that does not exist.`);
    } else if (edge.from === edge.to) {
      problems.push(`Edge ${edge.id} loops back to the same node.`);
    }
  }
  return problems;
}

export function outgoingEdges(graph: FlowGraph): Map<string, FlowEdge[]> {
  const out = new Map<string, FlowEdge[]>();
  for (const node of graph.nodes) out.set(node.id, []);
  for (const edge of graph.edges) out.get(edge.from)?.push(edge);
  return out;
}

/**
 * Nodes in topological order (Kahn's algorithm, ties broken by array order so the result is
 * stable). Notes always come last. If a cycle slips through, remaining nodes keep array order
 * rather than being dropped.
 */
export function orderNodes(graph: FlowGraph): FlowNode[] {
  const flowNodes = graph.nodes.filter((n) => n.kind !== 'note');
  const notes = graph.nodes.filter((n) => n.kind === 'note');
  const flowIds = new Set(flowNodes.map((n) => n.id));

  const indegree = new Map<string, number>(flowNodes.map((n) => [n.id, 0]));
  const out = outgoingEdges(graph);
  for (const edge of graph.edges) {
    if (flowIds.has(edge.from) && flowIds.has(edge.to)) {
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    }
  }

  const byId = new Map(flowNodes.map((n) => [n.id, n]));
  const position = new Map(flowNodes.map((n, i) => [n.id, i]));
  const ready = flowNodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  const ordered: FlowNode[] = [];
  const placed = new Set<string>();

  while (ready.length > 0) {
    ready.sort((a, b) => position.get(a)! - position.get(b)!);
    const id = ready.shift()!;
    placed.add(id);
    ordered.push(byId.get(id)!);
    for (const edge of out.get(id) ?? []) {
      if (!flowIds.has(edge.to)) continue;
      const left = (indegree.get(edge.to) ?? 0) - 1;
      indegree.set(edge.to, left);
      if (left === 0) ready.push(edge.to);
    }
  }
  for (const node of flowNodes) if (!placed.has(node.id)) ordered.push(node);
  return [...ordered, ...notes];
}
