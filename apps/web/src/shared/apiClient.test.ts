import { describe, expect, it } from "vitest";
import { apiClient, ApiError } from "./apiClient";

describe("apiClient (mock mode)", () => {
  it("is in mock mode by default", () => {
    expect(apiClient.isMockMode).toBe(true);
  });

  it("serves the iam-01 fixture bundle", async () => {
    const source = await apiClient.getSource("iam-01");
    expect(source.passage_id).toBe("iam-01");

    const flow = await apiClient.getFlow("iam-01");
    expect(flow.nodes.length).toBeGreaterThan(0);

    const summary = await apiClient.getSummary("iam-01");
    expect(summary.pointers.length).toBeGreaterThanOrEqual(3);

    const animation = await apiClient.getAnimation("iam-01");
    expect(animation.steps.length).toBeGreaterThan(0);
  });

  it("404s for any other passage id", async () => {
    await expect(apiClient.getSource("unknown-passage")).rejects.toBeInstanceOf(ApiError);
  });

  it("round-trips preferences writes", async () => {
    const prefs = await apiClient.getPreferences();
    const updated = await apiClient.putPreferences({ ...prefs, mode: "focus" });
    expect(updated.mode).toBe("focus");

    const reread = await apiClient.getPreferences();
    expect(reread.mode).toBe("focus");
  });
});
