import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SummaryFeaturePlaceholder from "./index";

describe("Summary placeholder view toggle", () => {
  it("defaults to Summary and shows the overview, not the points list", () => {
    render(<SummaryFeaturePlaceholder />);

    expect(screen.getByRole("button", { name: "Summary" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Point-wise details" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/synchronizing a component with an external system/)).toBeInTheDocument();
    expect(screen.queryByText("What useEffect is")).not.toBeInTheDocument();
  });

  it("switches to the point-wise list on click", async () => {
    const user = userEvent.setup();
    render(<SummaryFeaturePlaceholder />);

    await user.click(screen.getByRole("button", { name: "Point-wise details" }));

    expect(screen.getByRole("button", { name: "Point-wise details" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("What useEffect is")).toBeInTheDocument();
    expect(screen.getAllByText("Source").length).toBeGreaterThan(1);
  });
});
