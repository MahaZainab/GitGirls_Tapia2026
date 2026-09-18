/**
 * F3 UI placeholder. This directory belongs to the F3 agent (spec section
 * 2.5, rule A-02) -- replace this file with `AnimationPlayer` per spec
 * section 5, F3. This placeholder only proves the FOUNDATION plumbing
 * (API client, mock mode, `useMotionPolicy`) reaches this slot; it
 * implements none of F3's actual requirements.
 */
import { useEffect, useState } from "react";
import { useMotionPolicy } from "@studyshift/ui-tokens";
import type { AnimationScript } from "@studyshift/contracts";
import { apiClient } from "../../shared/apiClient";

export default function AnimationFeaturePlaceholder() {
  const [script, setScript] = useState<AnimationScript | null>(null);
  const motionPolicy = useMotionPolicy();

  useEffect(() => {
    apiClient.getAnimation("iam-01").then(setScript);
  }, []);

  return (
    <section aria-label="Animation (F3, not yet implemented)">
      <h2>F3: Animations</h2>
      <p>Not implemented yet. See agent-documents/StudyShift_Agent_Spec.md section 5, F3.</p>
      <p>
        Foundation check: <code>apiClient.getAnimation(&quot;iam-01&quot;)</code> returned{" "}
        {script ? <strong>{script.steps.length} steps</strong> : "loading..."}; current motion policy is{" "}
        <strong>{motionPolicy}</strong>.
      </p>
    </section>
  );
}
