import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("App shell", () => {
  it("renders one nav button per feature slot and starts on Summary", async () => {
    render(<App />);
    const nav = within(screen.getByRole("navigation", { name: "Features" }));

    expect(nav.getByRole("button", { name: "Summary" })).toHaveAttribute("aria-pressed", "true");
    expect(nav.getByRole("button", { name: "Flowchart" })).toHaveAttribute("aria-pressed", "false");
    expect(nav.getByRole("button", { name: "Animation" })).toHaveAttribute("aria-pressed", "false");
    expect(nav.getByRole("button", { name: "Preferences" })).toHaveAttribute("aria-pressed", "false");

    await waitFor(() =>
      expect(screen.getByText(/synchronizing a component with an external system/)).toBeInTheDocument(),
    );
  });

  it("switches slots on click and each slot proves its own foundation wiring", async () => {
    const user = userEvent.setup();
    render(<App />);
    const nav = within(screen.getByRole("navigation", { name: "Features" }));

    await user.click(nav.getByRole("button", { name: "Flowchart" }));
    await waitFor(() => expect(screen.getByText(/nodes,.*edges/)).toBeInTheDocument());

    await user.click(nav.getByRole("button", { name: "Animation" }));
    await waitFor(() => expect(screen.getByText(/steps/)).toBeInTheDocument());

    await user.click(nav.getByRole("button", { name: "Preferences" }));
    await waitFor(() => expect(screen.getByText(/mode/)).toBeInTheDocument());
  });

  it("jumps to the Summary tab after successfully adding material", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        passage_id: "demo-abc123",
        job_id: "job-1",
        job: { status: "failed", stage: "claims", error: "LLM_API_KEY not set" },
      }),
    }) as unknown as typeof fetch;

    const user = userEvent.setup();
    render(<App />);
    const nav = within(screen.getByRole("navigation", { name: "Features" }));

    await user.click(nav.getByRole("button", { name: "Add material" }));
    const addMaterialPage = within(screen.getByRole("region", { name: "Add material" }));
    await user.type(addMaterialPage.getByLabelText("Title"), "My passage");
    await user.type(addMaterialPage.getByLabelText("Text"), "Some sentence.");
    await user.click(addMaterialPage.getByRole("button", { name: "Add material" }));

    await waitFor(() => expect(nav.getByRole("button", { name: "Summary" })).toHaveAttribute("aria-pressed", "true"));
    expect(nav.getByRole("button", { name: "Add material" })).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText(/synchronizing a component with an external system/),
    ).toBeInTheDocument();
  });
});
