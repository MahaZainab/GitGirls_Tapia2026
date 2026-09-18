import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import FlowchartFeature from "../index";
import { setCurrentPassage } from "../../../shared/currentPassage";
import { eventBus } from "../../../shared/eventBus";
import { cloneFlow } from "./fixtures";

afterEach(() => {
  setCurrentPassage(null);
  vi.restoreAllMocks();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("Flowchart slot and Add material", () => {
  it("always shows the fixed Chain Rule flowchart until something is added, with no network", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<FlowchartFeature />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/Applying the Chain Rule/);
    expect(screen.getByRole("link", { name: "The Chain Rule" })).toHaveAttribute("href", expect.stringContaining("openstax.org"));
    expect(screen.getByText(/CC BY-NC-SA 4.0/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains each Chain Rule box from the source and reveals the exact phrase", async () => {
    const seen: unknown[] = [];
    const off = eventBus.on("anchor.reveal", (payload) => seen.push(payload));
    const user = userEvent.setup();
    render(<FlowchartFeature />);
    await user.click(screen.getByRole("button", { name: /Decision: Is h\(x\) of the form/ }));
    expect(screen.getByText(/For all values of x for which the derivative is defined/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "See original text" }));
    off();
    expect(seen).toHaveLength(1);
    expect((seen[0] as { anchor: { quote: string } }).anchor.quote).toBe("if h(x) = (g(x))^n");
  });

  it("still shows the built-in iam-01 flowchart when asked for it", async () => {
    render(<FlowchartFeature passageId="iam-01" />);
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
