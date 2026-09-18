/**
 * The passage the learner is currently working on (set when material is added). Features read it
 * with `useCurrentPassage()` instead of hardcoding a passage id. Null until something is added.
 */
import { useSyncExternalStore } from "react";

let current: string | null = null;
const listeners = new Set<() => void>();

export function getCurrentPassage(): string | null {
  return current;
}

export function setCurrentPassage(passageId: string | null): void {
  if (passageId === current) return;
  current = passageId;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCurrentPassage(): string | null {
  return useSyncExternalStore(subscribe, getCurrentPassage, () => null);
}
