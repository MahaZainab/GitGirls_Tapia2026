import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import FlowchartFeature from "../index";
import { setCurrentPassage } from "../../../shared/currentPassage";
import { cloneFlow } from "./fixtures";

afterEach(() => {
  setCurrentPassage(null);
  vi.restoreAllMocks();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("Flowchart slot and Add material", () => {
  it("shows the built-in passage until something is added", async () => {
    render(<FlowchartFeature />);
    expect(await screen.findByRole("img")).toHaveAccessibleName(/How a request is evaluated/);
  });

  it("builds a flowchart on the backend for the passage just added", async () => {
    const graph = { ...cloneFlow(), passage_id: "pasted-1", title: "My pasted text" };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(graph));
    render(<FlowchartFeature />);
    await screen.findByRole("img");
    act(() => setCurrentPassage("pasted-1")); // what AddMaterial does after a successful paste
    expect(await screen.findByRole("img", { name: /My pasted text/ })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/passages\/pasted-1\/flow\/generate$/);
    expect(init).toMatchObject({ method: "POST" });
  });

  it("shows what went wrong, and retries", async () => {
    const graph = { ...cloneFlow(), passage_id: "pasted-2", title: "Second paste" };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ detail: { message: "This text has 70 steps.", problems: [] } }, 422))
      .mockResolvedValueOnce(json(graph));
    setCurrentPassage("pasted-2");
    render(<FlowchartFeature />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This text has 70 steps.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("img", { name: /Second paste/ })).toBeInTheDocument();
  });

  it("says when the API is not running", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    setCurrentPassage("pasted-3");
    render(<FlowchartFeature />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Is apps\/api running/);
  });
});
