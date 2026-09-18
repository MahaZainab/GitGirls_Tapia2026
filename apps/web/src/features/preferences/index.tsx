/**
 * F4 UI entry point (spec section 5, F4). Replaces the FOUNDATION placeholder.
 * App.tsx renders this with no props as the "preferences" slot.
 */
import { FocusSessionProvider } from "./FocusSessionProvider";
import { PreferencesPage } from "./PreferencesPage";

export default function PreferencesFeature() {
  return (
    <FocusSessionProvider>
      <PreferencesPage />
    </FocusSessionProvider>
  );
}
