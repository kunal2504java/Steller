import { describe, it, expect } from "vitest";
import {
  REAL_WALLET,
  REAL_TX,
  SCRIPT_LINES,
  initialFrame,
} from "../terminal-script";

describe("terminal-script", () => {
  it("ends on the real testnet artifacts (short forms present)", () => {
    const joined = SCRIPT_LINES.join("\n");
    expect(joined).toContain(REAL_WALLET.slice(0, 6));
    expect(joined).toContain(REAL_TX.slice(0, 6));
    expect(joined).toContain("candela-kit");
  });

  it("reduced-motion frame renders every line and is done", () => {
    const f = initialFrame(true);
    expect(f.visibleLines).toEqual(SCRIPT_LINES);
    expect(f.done).toBe(true);
  });

  it("animated frame starts empty and not done", () => {
    const f = initialFrame(false);
    expect(f.visibleLines).toEqual([]);
    expect(f.done).toBe(false);
  });

  it("is deterministic — same output on repeat calls", () => {
    expect(initialFrame(true)).toEqual(initialFrame(true));
    expect(SCRIPT_LINES).toEqual([...SCRIPT_LINES]);
  });
});
