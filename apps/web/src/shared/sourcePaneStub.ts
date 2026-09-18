/**
 * Stub `anchor.reveal` handler (spec section 2.6). FOUNDATION-owned. F1 owns
 * the real `SourcePane` (highlighting, scrolling, live-region announcements
 * -- F1-R04). Until F1 mounts its own listener, this keeps the event
 * observable during development for F2/F3/G1, which all emit
 * `anchor.reveal` without needing F1 to exist yet.
 */
import type { Anchor } from "@studyshift/contracts";
import { eventBus } from "./eventBus";

export function installSourcePaneStub(): () => void {
  return eventBus.on<{ anchor: Anchor; origin: string }>("anchor.reveal", ({ anchor, origin }) => {
    // eslint-disable-next-line no-console
    console.info(`[SourcePane stub] anchor.reveal from "${origin}":`, anchor.quote);
  });
}
