/**
 * App shell (spec section 2.6): "an app shell with one empty slot per
 * feature. Feature agents can then work in parallel." FOUNDATION-owned.
 * Feature agents should not need to edit this file -- each feature's
 * top-level component is imported from its own directory and only this
 * shell's import line points at it.
 */
import { useEffect, useState } from "react";
import { MotionPolicyProvider } from "@studyshift/ui-tokens";
import AnimationFeature from "./features/animation";
import FlowchartFeature from "./features/flowchart";
import PreferencesFeature from "./features/preferences";
import SummaryFeature from "./features/summary";
import AddMaterial from "./material/AddMaterial";
import { LiveRegion } from "./shared/a11y";
import { ToastHost } from "./shared/notificationService";
import { PreferencesProvider, usePreferences } from "./shared/preferences";
import { installSourcePaneStub } from "./shared/sourcePaneStub";

const SLOTS = [
  { id: "material", label: "Add material" },
  { id: "summary", label: "Summary" },
  { id: "flowchart", label: "Flowchart" },
  { id: "animation", label: "Animation" },
  { id: "preferences", label: "Preferences" },
] as const;

function ThemedShell() {
  const { prefs } = usePreferences();

  useEffect(() => {
    installSourcePaneStub();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mode = prefs.mode;
    root.dataset.dyslexiaTypography = String(prefs.display.dyslexia_typography);
    root.style.setProperty("--text-scale", String(prefs.display.text_scale));
  }, [prefs.mode, prefs.display.dyslexia_typography, prefs.display.text_scale]);

  const [activeSlot, setActiveSlot] = useState<(typeof SLOTS)[number]["id"]>("summary");

  return (
    <MotionPolicyProvider userMotionSetting={prefs.display.motion}>
      <div style={{ minHeight: "100dvh" }}>
        <header
          style={{
            borderBottom: "1px solid var(--line)",
            padding: "0.75rem 1rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <strong>StudyShift</strong>
          <nav aria-label="Features" style={{ display: "flex", gap: "0.5rem" }}>
            {SLOTS.map((slot) => (
              <button
                key={slot.id}
                type="button"
                aria-pressed={activeSlot === slot.id}
                onClick={() => setActiveSlot(slot.id)}
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--line)",
                  background: activeSlot === slot.id ? "var(--brand)" : "var(--surface)",
                  color: activeSlot === slot.id ? "var(--brand-ink)" : "var(--ink)",
                }}
              >
                {slot.label}
              </button>
            ))}
          </nav>
        </header>
        <main style={{ padding: "1rem" }}>
          {activeSlot === "material" && <AddMaterial onSuccess={() => setActiveSlot("summary")} />}
          {activeSlot === "summary" && <SummaryFeature />}
          {activeSlot === "flowchart" && <FlowchartFeature />}
          {activeSlot === "animation" && <AnimationFeature />}
          {activeSlot === "preferences" && <PreferencesFeature />}
        </main>
        <ToastHost />
        <LiveRegion />
      </div>
    </MotionPolicyProvider>
  );
}

export default function App() {
  return (
    <PreferencesProvider>
      <ThemedShell />
    </PreferencesProvider>
  );
}
