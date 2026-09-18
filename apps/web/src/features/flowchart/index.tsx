/**
 * F2 UI placeholder. This directory belongs to the F2 agent (spec section
 * 2.5, rule A-02) -- replace this file with `FlowchartView` per spec
 * section 5, F2. This placeholder only proves the FOUNDATION plumbing
 * (API client, mock mode) reaches this slot; it implements none of F2's
 * actual requirements.
 */
import { useEffect, useState } from "react";
import type { FlowGraph } from "@studyshift/contracts";
import { apiClient } from "../../shared/apiClient";

export default function FlowchartFeaturePlaceholder() {
  const [flow, setFlow] = useState<FlowGraph | null>(null);

  useEffect(() => {
    apiClient.getFlow("iam-01").then(setFlow);
  }, []);

  return (
    <section aria-label="Flowchart (F2, not yet implemented)">
      <h2>F2: Flowcharts</h2>
      <p>Not implemented yet. See agent-documents/StudyShift_Agent_Spec.md section 5, F2.</p>
      <p>
        Foundation check: <code>apiClient.getFlow(&quot;iam-01&quot;)</code> returned{" "}
        {flow ? (
          <strong>
            {flow.nodes.length} nodes, {flow.edges.length} edges
          </strong>
        ) : (
          "loading..."
        )}
      </p>
    </section>
  );
}
