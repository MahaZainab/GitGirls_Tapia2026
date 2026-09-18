/**
 * F2 UI entry. The app shell mounts the default export in the Flowchart slot; other features
 * use the named exports (`FlowchartView` takes a graph plus an optional highlight from F3).
 */
import { useCallback, useEffect, useState } from "react";
import type { FlowGraph } from "@studyshift/contracts";
import { FlowchartView } from "./FlowchartView";
import { loadFlow, useCurrentPassage } from "./integration";

export { FlowchartView } from "./FlowchartView";
export type { FlowchartViewProps, FlowHighlight } from "./types";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; graph: FlowGraph };

/** Shows the flowchart for `passageId`, or for the passage last added in Add material (default: the built-in iam-01). */
export default function FlowchartFeature({ passageId }: { passageId?: string }) {
  const current = useCurrentPassage();
  const id = passageId ?? current ?? "iam-01";
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => {
    let stale = false;
    setState({ status: "loading" });
    loadFlow(id)
      .then((graph) => !stale && setState({ status: "ready", graph }))
      .catch((err: unknown) => {
        if (!stale) setState({ status: "error", message: err instanceof Error ? err.message : "Please try again." });
      });
    return () => {
      stale = true;
    };
  }, [id]);

  useEffect(load, [load]);

  if (state.status === "loading") return <p role="status">Building the flowchart…</p>;
  if (state.status === "error") {
    return (
      <div role="alert">
        <p>We couldn’t build the flowchart. {state.message}</p>
        <button type="button" onClick={load} style={{ minHeight: 44, minWidth: 44 }}>
          Try again
        </button>
      </div>
    );
  }
  return <FlowchartView graph={state.graph} />;
}
