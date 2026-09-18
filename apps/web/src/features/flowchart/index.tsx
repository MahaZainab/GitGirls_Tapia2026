/**
 * F2 UI entry. The app shell mounts the default export in the Flowchart slot; other features
 * use the named exports (`FlowchartView` takes a graph plus an optional highlight from F3).
 */
import { useCallback, useEffect, useState } from "react";
import type { Claim, FlowGraph } from "@studyshift/contracts";
import chainRuleData from "./demo/chainRule.json";
import { FlowchartView } from "./FlowchartView";
import { loadFlow, useCurrentPassage } from "./integration";

export { FlowchartView } from "./FlowchartView";
export type { FlowchartViewProps, FlowHighlight } from "./types";

/** The fixed flowchart shown until material is added: OpenStax Calculus Volume 1, section 3.6 (The Chain Rule). */
const CHAIN_RULE = chainRuleData as unknown as { flow: FlowGraph; claims: { claims: Claim[] } };
const CHAIN_RULE_URL = "https://openstax.org/books/calculus-volume-1/pages/3-6-the-chain-rule";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; graph: FlowGraph };

/**
 * Shows the flowchart for `passageId`, or for the passage last added in Add material. With neither, it shows
 * the fixed Chain Rule flowchart, which needs no API and always looks the same.
 */
export default function FlowchartFeature({ passageId }: { passageId?: string }) {
  const current = useCurrentPassage();
  const id = passageId ?? current;
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => {
    if (!id) return;
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

  if (!id) {
    return (
      <>
        <FlowchartView graph={CHAIN_RULE.flow} claims={CHAIN_RULE.claims.claims} />
        <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
          Source: <a href={CHAIN_RULE_URL}>The Chain Rule</a>, OpenStax Calculus Volume 1, section 3.6. © OpenStax, licensed{" "}
          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>. Shortened and drawn as a flowchart.
        </p>
      </>
    );
  }
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
