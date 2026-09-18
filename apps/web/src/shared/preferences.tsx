/**
 * Preferences context (spec section 3.4: `usePreferences()`). FOUNDATION-owned,
 * read-only for feature agents (A-02). Single source of truth for
 * `UserPreferences` so a change from any feature (F4 settings, G3 feedback
 * adapter, etc.) is seen everywhere at once. Emits `prefs.changed` with the
 * list of top-level keys that changed (spec section 3.3).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { iam01Bundle, type UserPreferences } from "@studyshift/contracts";
import { apiClient } from "./apiClient";
import { eventBus } from "./eventBus";

export interface PreferencesContextValue {
  prefs: UserPreferences;
  update(patch: Partial<UserPreferences>): Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UserPreferences>(iam01Bundle.preferencesRegular);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getPreferences()
      .then((loaded) => {
        if (!cancelled) setPrefs(loaded);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(
    async (patch: Partial<UserPreferences>) => {
      const changedKeys = Object.keys(patch);
      const previous = prefs;
      const next: UserPreferences = { ...prefs, ...patch };
      setPrefs(next); // optimistic; rolled back on failure (F4-R02)
      try {
        const saved = await apiClient.putPreferences(next);
        setPrefs(saved);
        setError(null);
        eventBus.emit("prefs.changed", { changed_keys: changedKeys });
      } catch (err) {
        setPrefs(previous);
        setError((err as Error).message);
        throw err;
      }
    },
    [prefs],
  );

  const value = useMemo(() => ({ prefs, update, isLoading, error }), [prefs, update, isLoading, error]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences() must be used inside <PreferencesProvider>");
  return ctx;
}
