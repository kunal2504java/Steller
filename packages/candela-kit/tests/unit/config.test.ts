import { describe, expect, it } from "vitest";
import { resolveConfig } from "../../src/core/config";

describe("resolveConfig", () => {
  it("resolves the testnet preset", () => {
    const c = resolveConfig("testnet");
    expect(c.rpcUrl).toBe("https://soroban-testnet.stellar.org");
    expect(c.networkPassphrase).toBe("Test SDF Network ; September 2015");
    expect(c.walletWasmHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("passes through a custom config verbatim", () => {
    const custom = {
      rpcUrl: "http://x",
      networkPassphrase: "p",
      walletWasmHash: "a".repeat(64),
    };
    expect(resolveConfig(custom)).toEqual(custom);
  });
});
