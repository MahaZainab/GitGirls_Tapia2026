import { describe, expect, it } from "vitest";
import { combineMotionPolicy } from "@studyshift/ui-tokens";

describe("combineMotionPolicy", () => {
  it("keeps the user's setting when the OS does not request reduced motion", () => {
    expect(combineMotionPolicy("full", false)).toBe("full");
    expect(combineMotionPolicy("reduced", false)).toBe("reduced");
    expect(combineMotionPolicy("off", false)).toBe("off");
  });

  it("caps a full preference at reduced when the OS requests reduced motion", () => {
    expect(combineMotionPolicy("full", true)).toBe("reduced");
  });

  it("never raises reduced or off back up to full because of the OS setting", () => {
    expect(combineMotionPolicy("reduced", true)).toBe("reduced");
    expect(combineMotionPolicy("off", true)).toBe("off");
  });
});
