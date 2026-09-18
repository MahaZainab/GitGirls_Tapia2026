/**
 * Typed event bus (spec section 2.2, 3.3). FOUNDATION-owned, read-only for
 * feature agents (A-02). Features communicate only through these events and
 * the component props documented in spec section 3.4 -- never by importing
 * another feature's internals.
 */
import type { EventEnvelope, EventType } from "@studyshift/contracts";

type Listener<T> = (payload: T, envelope: EventEnvelope<T>) => void;

class EventBus {
  private listeners = new Map<EventType, Set<Listener<any>>>();

  emit<T extends Record<string, unknown>>(type: EventType, payload: T): void {
    const envelope: EventEnvelope<T> = { type, at: new Date().toISOString(), payload };
    for (const listener of this.listeners.get(type) ?? []) {
      listener(payload, envelope);
    }
  }

  on<T extends Record<string, unknown>>(type: EventType, listener: Listener<T>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
    return () => set!.delete(listener);
  }
}

/** Single shared instance. Import this, don't construct your own EventBus. */
export const eventBus = new EventBus();

export function emitContractViolation(where: string, message: string): void {
  eventBus.emit("contract.violation", { where, message });
  // eslint-disable-next-line no-console
  console.warn(`[contract.violation] ${where}: ${message}`);
}
