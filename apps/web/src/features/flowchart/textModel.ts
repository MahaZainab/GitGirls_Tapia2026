import { KIND_LABEL, orderNodes, outgoingEdges } from './graph';
import type { FlowGraph, NodeKind, Tone } from './types';

export interface TextBranch {
  edgeId: string;
  /** Full sentence, e.g. "If yes, go to Denied" or "Next, go to Denied (implied)". */
  text: string;
  implied: boolean;
}

export interface TextItem {
  nodeId: string;
  kind: NodeKind;
  kindLabel: string;
  label: string;
  tone: Tone;
  /** e.g. "positive outcome"; empty for neutral nodes. Keeps tone from being color-only. */
  toneText: string;
  detail?: string;
  branches: TextBranch[];
  /** Set on end nodes and notes, which have no outgoing steps. */
  terminalText?: string;
}

const TONE_TEXT: Record<Tone, string> = {
  neutral: '',
  positive: 'positive outcome',
  negative: 'negative outcome',
};

/** Ordered, screen-reader-friendly description of the graph (F2-R05, F2-R12). */
export function buildTextVersion(graph: FlowGraph): TextItem[] {
  const labelOf = new Map(graph.nodes.map((n) => [n.id, n.label]));
  const out = outgoingEdges(graph);

  return orderNodes(graph).map((node) => {
    const edges = out.get(node.id) ?? [];
    const branches: TextBranch[] = edges.map((edge, index) => {
      const target = labelOf.get(edge.to) ?? edge.to;
      const implied = edge.basis === 'implied';
      const lead =
        node.kind === 'decision'
          ? `If ${edge.label?.trim() || `option ${index + 1}`}, go to`
          : edge.label?.trim()
            ? `Then (${edge.label.trim()}), go to`
            : 'Then go to';
      return { edgeId: edge.id, text: `${lead} ${target}${implied ? ' (implied)' : ''}`, implied };
    });

    return {
      nodeId: node.id,
      kind: node.kind,
      kindLabel: KIND_LABEL[node.kind],
      label: node.label,
      tone: node.tone,
      toneText: TONE_TEXT[node.tone],
      detail: node.detail || undefined,
      branches,
      terminalText:
        node.kind === 'terminal_end' ? 'End of the flow.' : node.kind === 'note' ? 'Side note, not a step.' : undefined,
    };
  });
}

/** One-sentence summary used as the SVG's aria-label (F2-R05). */
export function describeGraph(graph: FlowGraph): string {
  const count = (kind: NodeKind) => graph.nodes.filter((n) => n.kind === kind).length;
  const start = graph.nodes.find((n) => n.kind === 'terminal_start');
  const parts = [
    `Flowchart: ${graph.title}.`,
    `${graph.nodes.length} boxes, ${count('decision')} decisions, ${count('terminal_end')} end points.`,
  ];
  if (start) parts.push(`Starts at: ${start.label}.`);
  parts.push('A text version is available.');
  return parts.join(' ');
}
