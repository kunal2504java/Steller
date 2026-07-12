import { describe, it, expect } from "vitest";
import { copyLabel } from "../CopyButton";

describe("copyLabel", () => {
  it("shows the base text when not copied", () => {
    expect(copyLabel(false, "npm i candela-kit")).toBe("npm i candela-kit");
  });
  it("confirms after copy", () => {
    expect(copyLabel(true, "npm i candela-kit")).toBe("copied ✓");
  });
});
