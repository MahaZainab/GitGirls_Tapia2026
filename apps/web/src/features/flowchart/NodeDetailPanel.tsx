import { forwardRef } from 'react';
import { KIND_LABEL } from './graph';
import type { Anchor, Claim, FlowNode } from './types';

export type ClaimsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; claims: Claim[] };

interface Props {
  id: string;
  node: FlowNode;
  claims: ClaimsState;
  /** The anchor "See original text" will reveal, or undefined if none can be found yet. */
  anchor?: Anchor;
  onReveal: () => void;
  onRetry: () => void;
  onClose: () => void;
}

/** Non-modal panel for the selected box (F2-R04). Focus stays on the node; Close returns it there. */
export const NodeDetailPanel = forwardRef<HTMLElement, Props>(function NodeDetailPanel(
  { id, node, claims, anchor, onReveal, onRetry, onClose },
  ref,
) {
  const cited = claims.status === 'ready' ? node.claim_ids.map((cid) => claims.claims.find((c) => c.id === cid)) : [];

  return (
    <section id={id} ref={ref} className="fc-panel" aria-labelledby={`${id}-title`}>
      <div className="fc-panel__head">
        <div>
          <p className="fc-panel__kind">{KIND_LABEL[node.kind]}</p>
          <h3 id={`${id}-title`} className="fc-panel__title">
            {node.label}
          </h3>
        </div>
        <button type="button" className="fc-btn" onClick={onClose}>
          Close details
        </button>
      </div>

      {node.detail && <p className="fc-panel__detail">{node.detail}</p>}

      <div className="fc-panel__claims">
        <h4 className="fc-panel__subhead">From the source</h4>
        {claims.status === 'loading' && <p role="status">Loading the cited statements…</p>}
        {claims.status === 'error' && (
          <p role="alert">
            We couldn’t load the cited statements. {claims.message}{' '}
            <button type="button" className="fc-btn" onClick={onRetry}>
              Try again
            </button>
          </p>
        )}
        {claims.status === 'ready' && (
          <ul className="fc-panel__list">
            {node.claim_ids.map((cid, i) => (
              <li key={cid}>{cited[i]?.text ?? `Statement ${cid} was not found.`}</li>
            ))}
          </ul>
        )}
      </div>

      {anchor ? (
        <button type="button" className="fc-btn fc-btn--primary" onClick={onReveal}>
          See original text
        </button>
      ) : (
        claims.status !== 'loading' && <p className="fc-muted">No source text is linked to this box.</p>
      )}
    </section>
  );
});
