import { useId } from 'react';
import { describeGraph } from './textModel';
import { KIND_LABEL } from './graph';
import { FONT_SIZE, LINE_HEIGHT, pathFor, type LaidOutNode, type Layout } from './layout';
import type { FlowGraph } from './types';

interface Props {
  graph: FlowGraph;
  layout: Layout;
  /** Node ids in topological order; DOM order of the buttons = tab order (F2-R06). */
  tabOrder: string[];
  emphasizedNodes: Set<string>;
  emphasizedEdges: Set<string>;
  selectedId: string | null;
  panelId: string;
  registerButton: (nodeId: string, el: HTMLButtonElement | null) => void;
  onSelect: (nodeId: string) => void;
}

const TONE_WORD = { neutral: '', positive: ', positive outcome', negative: ', negative outcome' };

function Shape({ node, inflate = 0, className }: { node: LaidOutNode; inflate?: number; className: string }) {
  const w = node.width + inflate * 2;
  const h = node.height + inflate * 2;
  const x = node.x - w / 2;
  const y = node.y - h / 2;
  if (node.kind === 'decision') {
    const points = `${node.x},${y} ${x + w},${node.y} ${node.x},${y + h} ${x},${node.y}`;
    return <polygon className={className} points={points} />;
  }
  const rx = node.kind === 'terminal_start' || node.kind === 'terminal_end' ? h / 2 : 10 + inflate;
  return <rect className={className} x={x} y={y} width={w} height={h} rx={rx} />;
}

/**
 * The SVG drawing plus a layer of real <button>s positioned over each box. The SVG is role="img"
 * (its children are presentational to assistive tech), so interaction lives in the button layer.
 * All text is rendered as SVG/DOM text nodes; nothing model-generated becomes markup (F2-R10).
 */
export function FlowchartDiagram({
  graph,
  layout,
  tabOrder,
  emphasizedNodes,
  emphasizedEdges,
  selectedId,
  panelId,
  registerButton,
  onSelect,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const marker = (variant: string) => `fc-arrow-${variant}-${uid}`;
  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <div className="fc__stage" style={{ width: layout.width, height: layout.height }}>
      <svg
        className="fc__svg"
        role="img"
        aria-label={describeGraph(graph)}
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        fontSize={FONT_SIZE}
      >
        <defs>
          {(['normal', 'implied', 'active'] as const).map((variant) => (
            <marker
              key={variant}
              id={marker(variant)}
              className={`fc-arrow fc-arrow--${variant}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="9"
              markerHeight="9"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          ))}
        </defs>

        <g className="fc__edges">
          {layout.edges.map((edge) => {
            const active = emphasizedEdges.has(edge.id);
            const variant = active ? 'active' : edge.implied ? 'implied' : 'normal';
            return (
              <path
                key={edge.id}
                className={`fc-edge${edge.implied ? ' fc-edge--implied' : ''}${active ? ' is-active' : ''}`}
                d={pathFor(edge.points)}
                markerEnd={`url(#${marker(variant)})`}
              />
            );
          })}
        </g>

        <g className="fc__nodes">
          {layout.nodes.map((node) => {
            const emphasized = emphasizedNodes.has(node.id) || selectedId === node.id;
            const firstY = node.y - ((node.lines.length - 1) * LINE_HEIGHT) / 2;
            return (
              <g
                key={node.id}
                className={`fc-node fc-node--${node.kind} fc-node--${node.tone}${emphasized ? ' is-emphasized' : ''}`}
              >
                {emphasized && <Shape node={node} inflate={7} className="fc-node__ring" />}
                <Shape node={node} className="fc-node__shape" />
                <text className="fc-node__text" textAnchor="middle" dominantBaseline="central">
                  {node.lines.map((line, i) => (
                    <tspan key={i} x={node.x} y={firstY + i * LINE_HEIGHT}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </g>

        <g className="fc__edge-labels">
          {layout.edges.map(
            (edge) =>
              edge.label &&
              edge.labelBox && (
                <g key={edge.id} className="fc-edge-label">
                  <rect
                    x={edge.labelBox.x - edge.labelBox.width / 2}
                    y={edge.labelBox.y - edge.labelBox.height / 2}
                    width={edge.labelBox.width}
                    height={edge.labelBox.height}
                    rx={6}
                  />
                  <text x={edge.labelBox.x} y={edge.labelBox.y} textAnchor="middle" dominantBaseline="central">
                    {edge.label}
                  </text>
                </g>
              ),
          )}
        </g>
      </svg>

      <div className="fc__hits">
        {tabOrder.map((id) => {
          const node = nodeById.get(id);
          const source = graph.nodes.find((n) => n.id === id);
          if (!node || !source) return null;
          return (
            <button
              key={id}
              ref={(el) => registerButton(id, el)}
              type="button"
              className="fc__hit"
              style={{ left: node.x - node.width / 2, top: node.y - node.height / 2, width: node.width, height: node.height }}
              aria-label={`${KIND_LABEL[source.kind]}: ${source.label}${TONE_WORD[source.tone]}`}
              aria-pressed={selectedId === id}
              aria-controls={selectedId === id ? panelId : undefined}
              onClick={() => onSelect(id)}
            />
          );
        })}
      </div>
    </div>
  );
}
