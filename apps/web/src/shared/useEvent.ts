import { useEffect } from "react";
import type { EventType } from "@studyshift/contracts";
import { eventBus } from "./eventBus";

/** Subscribe to an event-bus event for the lifetime of the component. */
export function useEvent<T extends Record<string, unknown>>(
  type: EventType,
  handler: (payload: T) => void,
): void {
  useEffect(() => eventBus.on<T>(type, handler), [type, handler]);
}
