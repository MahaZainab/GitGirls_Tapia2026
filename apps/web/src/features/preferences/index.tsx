/**
 * F4 UI placeholder. This directory belongs to the F4 agent (spec section
 * 2.5, rule A-02) -- replace this file with `PreferencesPage`,
 * `FocusSessionProvider` and the DND-aware `NotificationService` wrapper per
 * spec section 5, F4. This placeholder only proves the FOUNDATION plumbing
 * (`usePreferences`, the plain-toast `NotificationService`) reaches this
 * slot; it implements none of F4's actual requirements (no Pomodoro, no
 * rain, no DND policy).
 */
import { usePreferences } from "../../shared/preferences";
import { NotificationService } from "../../shared/notificationService";

export default function PreferencesFeaturePlaceholder() {
  const { prefs, isLoading, error } = usePreferences();

  return (
    <section aria-label="Preferences (F4, not yet implemented)">
      <h2>F4: Account preferences</h2>
      <p>Not implemented yet. See agent-documents/StudyShift_Agent_Spec.md section 5, F4.</p>
      <p>
        Foundation check: <code>usePreferences()</code> reports mode{" "}
        <strong>{isLoading ? "loading..." : prefs.mode}</strong>
        {error ? ` (error: ${error})` : ""}.
      </p>
      <button
        type="button"
        onClick={() =>
          NotificationService.notify({
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            category: "system",
            title: "Foundation check",
            body: "This is the plain-toast NotificationService F4 will wrap with DND policy.",
          })
        }
      >
        Send a test toast
      </button>
    </section>
  );
}
