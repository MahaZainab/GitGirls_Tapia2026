import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AddMaterial from "./AddMaterial";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("AddMaterial", () => {
  it("disables submit until a title and text are present", async () => {
    render(<AddMaterial />);
    expect(screen.getByRole("button", { name: /add material/i })).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Title"), "My passage");
    expect(screen.getByRole("button", { name: /add material/i })).toBeDisabled();

    await user.type(screen.getByLabelText("Text"), "Some sentence.");
    expect(screen.getByRole("button", { name: /add material/i })).toBeEnabled();
  });

  it("posts a multipart request and shows the resulting passage id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        passage_id: "demo-abc123",
        job_id: "job-1",
        job: { status: "failed", stage: "claims", error: "LLM_API_KEY not set" },
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<AddMaterial />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Title"), "My passage");
    await user.type(screen.getByLabelText("Text"), "Some sentence.");
    await user.click(screen.getByRole("button", { name: /add material/i }));

    await waitFor(() => expect(screen.getByText(/demo-abc123/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/materials"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("switches to the Link field when Link mode is chosen", async () => {
    render(<AddMaterial />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Link" }));
    expect(screen.getByPlaceholderText("https://example.com/article")).toBeInTheDocument();
    expect(screen.queryByLabelText("Text")).not.toBeInTheDocument();
  });
});
