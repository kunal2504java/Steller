import { describe, expect, it } from "vitest";
import { canUsePasskeys } from "../../src/core/passkeys";

describe("canUsePasskeys", () => {
  it("is false when PublicKeyCredential is absent (jsdom default)", () => {
    expect(canUsePasskeys()).toBe(false);
  });
  it("is true when the API is present", () => {
    (globalThis as any).window.PublicKeyCredential = class {};
    expect(canUsePasskeys()).toBe(true);
    delete (globalThis as any).window.PublicKeyCredential;
  });
});
