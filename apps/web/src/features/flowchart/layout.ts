import dagre from '@dagrejs/dagre';
import type { FlowGraph, NodeKind, Tone } from './types';

export const FONT_SIZE = 16; // user units; 16px at 100% zoom, above the 14px minimum (F2-R09)
export const LINE_HEIGHT = 22;
const CHAR_WIDTH = FONT_SIZE * 0.6; // Lexend is wide; err on the roomy side
const MARGIN = 24;

export interface Point {
  x: number;
  y: number;
}

export interface LaidOutNode {
  id: string;
  kind: NodeKind;
  tone: Tone;
  label: string;
  /** Wrapped lines, first line carries the tone glyph so tone is never color-only. */
  lines: string[];
  x: number; // center
  y: number;
  width: number;
  height: number;
}

export interface LaidOutEdge {
  id: string;
  from: string;
  to: string;
  points: Point[];
  label?: string;
  labelBox?: { x: number; y: number; width: number; height: number };
  implied: boolean;
}

export interface Layout {
  width: number;
  height: number;
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
}

const TONE_GLYPH: Record<Tone, string> = { neutral: '', positive: '✓ ', negative: '✕ ' };

function textWidth(text: string): number {
  return text.length * CHAR_WIDTH;
}

export function wrapText(text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && textWidth(next) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function sizeNode(kind: NodeKind, tone: Tone, label: string) {
  const wrapAt = kind === 'decision' ? 150 : 240;
  const lines = wrapText(`${TONE_GLYPH[tone]}${label}`, wrapAt);
  const textW = Math.max(...lines.map(textWidth));
  const textH = lines.length * LINE_HEIGHT;

  if (kind === 'decision') {
    // A diamond only fits text in its middle; doubling the text box keeps corners inside.
    return { lines, width: Math.max(170, (textW + 16) * 1.9), height: Math.max(92, (textH + 8) * 1.9) };
  }
  const padX = kind === 'terminal_start' || kind === 'terminal_end' ? 30 : 22;
  return { lines, width: Math.max(120, textW + padX * 2), height: Math.max(48, textH + 28) };
}

/** Where the line from a node's center toward `toward` crosses the node's outline. */
export function clipToShape(
  node: { kind: NodeKind; x: number; y: number; width: number; height: number },
  toward: Point,
): Point {
  const dx = toward.x - node.x;
  const dy = toward.y - node.y;
  if (dx === 0 && dy === 0) return { x: node.x, y: node.y };
  const hw = node.width / 2;
  const hh = node.height / 2;
  const t =
    node.kind === 'decision'
      ? 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh)
      : 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
  return { x: node.x + dx * t, y: node.y + dy * t };
}

/** Top-to-bottom layout (F2-R01). Throws if the layout library does; callers must catch (F2-R08). */
export function computeLayout(graph: FlowGraph): Layout {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'TB', nodesep: 56, ranksep: 64, edgesep: 24, marginx: MARGIN, marginy: MARGIN, acyclicer: 'greedy' });
  g.setDefaultEdgeLabel(() => ({}));

  const sized = new Map<string, ReturnType<typeof sizeNode>>();
  for (const node of graph.nodes) {
    const size = sizeNode(node.kind, node.tone, node.label);
    sized.set(node.id, size);
    g.setNode(node.id, { width: size.width, height: size.height });
  }
  for (const edge of graph.edges) {
    const label = edge.label?.trim();
    g.setEdge(
      edge.from,
      edge.to,
      label
        ? { width: textWidth(label) + 16, height: LINE_HEIGHT + 6, labelpos: 'l', labeloffset: 8 }
        : {},
      edge.id,
    );
  }

  dagre.layout(g);

  const nodes: LaidOutNode[] = graph.nodes.map((node) => {
    const pos = g.node(node.id);
    const size = sized.get(node.id)!;
    return {
      id: node.id,
      kind: node.kind,
      tone: node.tone,
      label: node.label,
      lines: size.lines,
      x: pos.x,
      y: pos.y,
      width: size.width,
      height: size.height,
    };
  });
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const edges: LaidOutEdge[] = graph.edges.map((edge) => {
    const laid = g.edge({ v: edge.from, w: edge.to, name: edge.id });
    const points: Point[] = (laid.points ?? []).map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
    const from = nodeById.get(edge.from)!;
    const to = nodeById.get(edge.to)!;
    if (points.length >= 2) {
      // dagre clips to bounding boxes, which floats off a diamond's corners; re-clip to the shape.
      points[0] = clipToShape(from, points[1]);
      points[points.length - 1] = clipToShape(to, points[points.length - 2]);
    }
    const label = edge.label?.trim();
    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      points,
      label: label || undefined,
      labelBox:
        label && laid.x !== undefined && laid.y !== undefined
          ? { x: laid.x, y: laid.y, width: textWidth(label) + 16, height: LINE_HEIGHT + 6 }
          : undefined,
      implied: edge.basis === 'implied',
    };
  });

  const { width = 0, height = 0 } = g.graph();
  return { width: Math.ceil(width), height: Math.ceil(height), nodes, edges };
}

/** Smooth path through the routed points (quadratic curves through segment midpoints). */
export function pathFor(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    d += ` Q ${points[i].x} ${points[i].y} ${mid.x} ${mid.y}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}
