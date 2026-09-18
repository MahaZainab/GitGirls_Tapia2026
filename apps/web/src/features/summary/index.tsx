/**
 * F1 UI placeholder. This directory belongs to the F1 agent (spec section
 * 2.5, rule A-02) -- replace this file with `SummaryPanel` and `SourcePane`
 * per spec section 5, F1. This placeholder only proves the FOUNDATION
 * plumbing (API client, mock mode) reaches this slot; it implements none of
 * F1's actual requirements.
 */
import { useEffect, useState } from "react";
import type { Source } from "@studyshift/contracts";
import { apiClient } from "../../shared/apiClient";

export default function SummaryFeaturePlaceholder() {
  const [source, setSource] = useState<Source | null>(null);

  useEffect(() => {
    apiClient.getSource("iam-01").then(setSource);
  }, []);

  return (
    <section aria-label="Summary (F1, not yet implemented)">
      <h2>F1: Summary, examples and pointers</h2>
      <p>Not implemented yet. See agent-documents/StudyShift_Agent_Spec.md section 5, F1.</p>
      <p>
        Foundation check: <code>apiClient.getSource(&quot;iam-01&quot;)</code> returned{" "}
        {source ? <strong>&ldquo;{source.title}&rdquo;</strong> : "loading..."}
      </p>
    </section>
  );
}
