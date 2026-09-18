import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App shell", () => {
  it("renders one nav button per feature slot and starts on Summary", async () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Summary" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Flowchart" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Animation" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Preferences" })).toHaveAttribute("aria-pressed", "false");

    await waitFor(() => expect(screen.getByText(/AWS decides to allow or deny/)).toBeInTheDocument());
  });

  it("switches slots on click and each slot proves its own foundation wiring", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Flowchart" }));
    await waitFor(() => expect(screen.getByText(/nodes,.*edges/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Animation" }));
    await waitFor(() => expect(screen.getByText(/steps/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Preferences" }));
    await waitFor(() => expect(screen.getByText(/mode/)).toBeInTheDocument());
  });
});
