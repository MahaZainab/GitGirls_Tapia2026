/**
 * Accessibility helpers (spec section 2.6, cross-cutting X-01..X-08).
 * FOUNDATION-owned, read-only for feature agents (A-02).
 */
import { useEffect, useState, type CSSProperties } from "react";

export const visuallyHiddenStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

type Announcer = (message: string) => void;
let announceImpl: Announcer | null = null;

/** Announce `message` in the shared polite live region (F1-R04, F3-R04). */
export function announce(message: string): void {
  announceImpl?.(message);
}

/** Mount once near the app root (see `App.tsx`). */
export function LiveRegion() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    announceImpl = (msg: string) => {
      // Clear first so identical consecutive messages are still announced.
      setMessage("");
      requestAnimationFrame(() => setMessage(msg));
    };
    return () => {
      announceImpl = null;
    };
  }, []);

  return (
    <div aria-live="polite" role="status" style={visuallyHiddenStyle}>
      {message}
    </div>
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Trap Tab/Shift+Tab focus inside `container` (X-04, F4-R14: "Dialogs trap
 * focus and return it on close"). Caller is responsible for restoring focus
 * to the trigger element on close.
 */
export function trapFocus(container: HTMLElement): () => void {
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  container.addEventListener("keydown", onKeyDown);
  return () => container.removeEventListener("keydown", onKeyDown);
}
