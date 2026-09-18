import { Component, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlowchartDiagram } from './FlowchartDiagram';
import { NodeDetailPanel, type ClaimsState } from './NodeDetailPanel';
import { TextVersion } from './TextVersion';
import { VerificationBanner } from './VerificationBanner';
import { findGraphProblems, orderNodes } from './graph';
import { computeLayout, type Layout } from './layout';
import { emitAnchorReveal, emitNodeSelected, fetchClaims, useMotionPolicy } from './integration';
import type { Anchor, Claim, FlowchartViewProps } from './types';
import './flowchart.css';

const MIN_FIT_SCALE = 0.875; // 14px text at fit; below this the region scrolls instead (F2-R09)
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;
const EMPTY = new Set<string>();

/** If the drawing throws while rendering, fall back to the text version instead of a blank area. */
class DiagramBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function FlowchartView({ graph, highlight, onNodeSelect, claims: claimsProp }: FlowchartViewProps) {
  const motion = useMotionPolicy();
  const panelId = useId();
  const [view, setView] = useState<'diagram' | 'text'>('diagram');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | null>(null); // null = fit to width
  const [announcement, setAnnouncement] = useState('');
  const [scrollRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const panelRef = useRef<HTMLElement>(null);

  // Validate and lay out once per graph. Any failure means: show the text version and a message.
  const { layout, tabOrder, problem } = useMemo<{ layout: Layout | null; tabOrder: string[]; problem: string | null }>(() => {
    const problems = findGraphProblems(graph);
    if (problems.length > 0) return { layout: null, tabOrder: [], problem: problems[0] };
    try {
      return { layout: computeLayout(graph), tabOrder: orderNodes(graph).map((n) => n.id), problem: null };
    } catch {
      return { layout: null, tabOrder: [], problem: 'The diagram could not be laid out.' };
    }
  }, [graph]);

  // A new graph invalidates any selection.
  useEffect(() => {
    setSelectedId(null);
    setZoom(null);
  }, [graph]);

  // ---- cited claims for the detail panel (lazy: only fetched once a box is selected) ----
  const [fetched, setFetched] = useState<ClaimsState | null>(null);
  const loadClaims = useCallback(() => {
    setFetched({ status: 'loading' });
    fetchClaims(graph.passage_id)
      .then((claims) => setFetched({ status: 'ready', claims }))
      .catch((err: unknown) =>
        setFetched({ status: 'error', message: err instanceof Error ? err.message : 'Please try again.' }),
      );
  }, [graph.passage_id]);
  useEffect(() => setFetched(null), [graph.passage_id]);
  useEffect(() => {
    if (selectedId && !claimsProp && fetched === null) loadClaims();
  }, [selectedId, claimsProp, fetched, loadClaims]);

  const claimsState: ClaimsState = claimsProp
    ? { status: 'ready', claims: claimsProp }
    : (fetched ?? { status: 'loading' });
  const claimList: Claim[] = claimsState.status === 'ready' ? claimsState.claims : [];

  const selectedNode = graph.nodes.find((n) => n.id === selectedId) ?? null;
  const revealAnchor: Anchor | undefined = selectedNode
    ? (selectedNode.anchor ?? claimList.find((c) => c.id === selectedNode.claim_ids[0])?.anchor)
    : undefined;

  const select = (nodeId: string) => {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setSelectedId(nodeId);
    setAnnouncement(`Selected ${node.label}. Details are shown below the chart.`);
    emitNodeSelected(nodeId);
    onNodeSelect?.(nodeId);
  };

  const closePanel = () => {
    const id = selectedId;
    setSelectedId(null);
    setAnnouncement('Details closed.');
    if (id) buttons.current.get(id)?.focus();
  };

  const emphasizedNodes = useMemo(() => new Set(highlight?.nodeIds ?? []), [highlight]);
  const emphasizedEdges = useMemo(() => new Set(highlight?.edgeIds ?? []), [highlight]);

  // ---- zoom and pan (F2-R09) ----
  const fitScale = layout && containerWidth > 0 ? Math.min(1, Math.max(MIN_FIT_SCALE, containerWidth / layout.width)) : 1;
  const scale = zoom ?? fitScale;
  const zoomBy = (delta: number) =>
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((scale + delta) * 100) / 100)));

  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    const el = e.currentTarget;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    e.currentTarget.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
    e.currentTarget.scrollTop = drag.current.top - (e.clientY - drag.current.y);
  };
  const endDrag = () => {
    drag.current = null;
  };

  const showText = view === 'text' || !layout;
  const textFallback = (
    <>
      <p className="fc-message" role="status">
        {problem ?? 'The diagram could not be drawn.'} Here is the text version of the flowchart instead.
      </p>
      <TextVersion graph={graph} />
    </>
  );

  return (
    <section className="fc" data-motion={motion} aria-label={`Flowchart: ${graph.title}`}>
      <h2 className="fc__title">{graph.title}</h2>
      <VerificationBanner verification={graph.verification} />

      <div className="fc__toolbar">
        <div className="fc__group" role="group" aria-label="Flowchart view">
          <button type="button" className="fc-btn" aria-pressed={!showText} disabled={!layout} onClick={() => setView('diagram')}>
            Diagram
          </button>
          <button type="button" className="fc-btn" aria-pressed={showText} onClick={() => setView('text')}>
            Text version
          </button>
        </div>
        {!showText && (
          <div className="fc__group" role="group" aria-label="Zoom">
            <button type="button" className="fc-btn" onClick={() => zoomBy(-ZOOM_STEP)} disabled={scale <= MIN_ZOOM}>
              Zoom out
            </button>
            <span className="fc__zoom" aria-live="polite">
              {Math.round(scale * 100)}%
            </span>
            <button type="button" className="fc-btn" onClick={() => zoomBy(ZOOM_STEP)} disabled={scale >= MAX_ZOOM}>
              Zoom in
            </button>
            <button type="button" className="fc-btn" onClick={() => setZoom(null)} disabled={zoom === null}>
              Fit to width
            </button>
          </div>
        )}
      </div>

      {showText ? (
        layout ? <TextVersion graph={graph} /> : textFallback
      ) : (
        <DiagramBoundary fallback={textFallback}>
          <div
            ref={scrollRef}
            className="fc__scroll"
            role="region"
            aria-label="Flowchart diagram. Scrolls sideways if it does not fit."
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="fc__sizer" style={{ width: layout!.width * scale, height: layout!.height * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: layout!.width, height: layout!.height }}>
                <FlowchartDiagram
                  graph={graph}
                  layout={layout!}
                  tabOrder={tabOrder}
                  emphasizedNodes={emphasizedNodes.size ? emphasizedNodes : EMPTY}
                  emphasizedEdges={emphasizedEdges.size ? emphasizedEdges : EMPTY}
                  selectedId={selectedId}
                  panelId={panelId}
                  registerButton={(id, el) => {
                    if (el) buttons.current.set(id, el);
                    else buttons.current.delete(id);
                  }}
                  onSelect={select}
                />
              </div>
            </div>
          </div>
          <p className="fc-legend">
            Dashed arrows are implied by the source rather than stated. Select any box for details.
          </p>
        </DiagramBoundary>
      )}

      {selectedNode && (
        <NodeDetailPanel
          id={panelId}
          ref={panelRef}
          node={selectedNode}
          claims={claimsState}
          anchor={revealAnchor}
          onReveal={() => revealAnchor && emitAnchorReveal(revealAnchor)}
          onRetry={loadClaims}
          onClose={closePanel}
        />
      )}

      <p className="fc-sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
