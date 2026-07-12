import { describe, it, expect, vi } from "vitest";

// The `server-only` package throws when imported outside Next's
// `react-server` bundler condition (which includes Vitest). Mock it to an
// empty module so importing chain.ts doesn't blow up in the test runner.
vi.mock("server-only", () => ({}));

// Force the dynamic stellar-sdk import to throw so we hit the fallback path
// deterministically (no network in unit tests).
vi.mock("@stellar/stellar-sdk", () => {
  throw new Error("no network in unit test");
});

describe("getChainStats", () => {
  it("fails soft to em-dashes and still returns real links", async () => {
    const { getChainStats } = await import("../chain");
    const stats = await getChainStats();
    expect(stats.sponsoredTxns).toBe("—");
    expect(stats.contractUrl).toContain("stellar.expert");
    expect(stats.genesisTx.length).toBeGreaterThan(0);
    expect(stats.network.length).toBeGreaterThan(0);
  });
});
