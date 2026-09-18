/**
 * Baseline notification service (spec section 2.6): "a NotificationService
 * that shows plain toasts". FOUNDATION-owned, read-only for feature agents
 * (A-02). This has no Do Not Disturb awareness -- F4 owns that policy
 * (spec section 3.4: "NotificationService: { notify(...) } // policy lives
 * in F4") and should wrap `notify` from `features/preferences`, holding
 * categories other than `security` while a DND session is active, rather
 * than editing this file.
 */
import { useEffect, useState } from "react";
import type { NotificationItem } from "@studyshift/contracts";

type Listener = (item: NotificationItem) => void;

const listeners = new Set<Listener>();

/** Plain toast notifier: shows everything immediately, no suppression. */
export const NotificationService = {
  notify(item: NotificationItem): void {
    for (const listener of listeners) listener(item);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

const AUTO_DISMISS_MS = 6000;

/** Mount once near the app root. Renders whatever `NotificationService.notify` is given. */
export function ToastHost() {
  const [toasts, setToasts] = useState<NotificationItem[]>([]);

  useEffect(
    () =>
      NotificationService.subscribe((item) => {
        setToasts((prev) => [...prev, item]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== item.id));
        }, AUTO_DISMISS_MS);
      }),
    [],
  );

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        insetInlineEnd: "1rem",
        insetBlockEnd: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        zIndex: 1000,
        maxWidth: "min(90vw, 320px)",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: "var(--surface)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          <strong>{t.title}</strong>
          {t.body ? <p style={{ margin: "0.25rem 0 0" }}>{t.body}</p> : null}
        </div>
      ))}
    </div>
  );
}
