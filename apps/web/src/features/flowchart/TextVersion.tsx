import { useMemo } from 'react';
import { buildTextVersion } from './textModel';
import type { FlowGraph } from './types';

/** Always-available text alternative to the diagram (F2-R05, F2-R12). */
export function TextVersion({ graph }: { graph: FlowGraph }) {
  const items = useMemo(() => buildTextVersion(graph), [graph]);

  return (
    <ol className="fc-text" aria-label={`Text version of the flowchart: ${graph.title}`}>
      {items.map((item) => (
        <li key={item.nodeId} className="fc-text__item">
          <p className="fc-text__label">
            <span className="fc-text__kind">{item.kindLabel}:</span> {item.label}
            {item.toneText && <span className="fc-text__tone"> ({item.toneText})</span>}
          </p>
          {item.detail && <p className="fc-text__detail">{item.detail}</p>}
          {item.branches.map((branch) => (
            <p key={branch.edgeId} className="fc-text__branch">
              {branch.text}
            </p>
          ))}
          {item.terminalText && <p className="fc-text__branch">{item.terminalText}</p>}
        </li>
      ))}
    </ol>
  );
}
