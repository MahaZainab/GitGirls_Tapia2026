import { describe, expect, it, vi } from "vitest";
import { eventBus } from "./eventBus";

describe("eventBus", () => {
  it("delivers a payload to subscribers of the same event type", () => {
    const handler = vi.fn();
    const unsubscribe = eventBus.on<{ node_id: string }>("flow.node.selected", handler);

    eventBus.emit("flow.node.selected", { node_id: "N1" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toEqual({ node_id: "N1" });
    unsubscribe();
  });

  it("stops delivering events after unsubscribe", () => {
    const handler = vi.fn();
    const unsubscribe = eventBus.on("prefs.changed", handler);
    unsubscribe();

    eventBus.emit("prefs.changed", { changed_keys: ["mode"] });

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not deliver events of one type to listeners of another", () => {
    const handler = vi.fn();
    eventBus.on("animation.step.changed", handler);

    eventBus.emit("focus.session.started", { state: "work", cycles_completed: 0 });

    expect(handler).not.toHaveBeenCalled();
  });
});
