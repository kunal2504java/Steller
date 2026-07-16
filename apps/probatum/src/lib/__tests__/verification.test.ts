import { describe, expect, it } from "vitest";
import demo from "../../../../../fixtures/probatum-testnet-demo.json";
import { decodeEnvelope, encodeEnvelope } from "../certificate";
import { hexToBytes } from "../merkle";
import {
  resolveVerification,
  type VerificationChain,
} from "../verification";

const routeId = demo.certificates[0].routeId;

function chain(overrides: Partial<VerificationChain> = {}): VerificationChain {
  return {
    getBatch: async () => ({
      root: hexToBytes(demo.root),
      issuer: "GISSUER",
      revoked: false,
      anchoredAt: 123n,
      count: demo.count,
      meta: new Uint8Array(32),
    }),
    isBatchRevoked: async () => false,
    isLeafRevoked: async () => false,
    claimOf: async () => null,
    getIssuerProfile: async () => hexToBytes("11".repeat(32)),
    ...overrides,
  };
}

describe("resolveVerification", () => {
  it("resolves a matching proof and live batch as VALID", async () => {
    const result = await resolveVerification(routeId, chain());
    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.state).toBe("VALID");
      expect(result.envelope?.payload.certificateId).toBe("demo-01");
      expect(result.claimedBy).toBeNull();
    }
  });

  it("gives batch revocation precedence over VALID", async () => {
    const result = await resolveVerification(routeId, chain({ isBatchRevoked: async () => true }));
    expect(result.kind === "resolved" && result.state).toBe("REVOKED");
  });

  it("gives leaf revocation precedence over VALID", async () => {
    const result = await resolveVerification(routeId, chain({ isLeafRevoked: async () => true }));
    expect(result.kind === "resolved" && result.state).toBe("REVOKED");
  });

  it("marks a changed payload TAMPERED", async () => {
    const envelope = decodeEnvelope(routeId);
    envelope.payload.recipient = "Changed recipient";
    const result = await resolveVerification(encodeEnvelope(envelope), chain());
    expect(result.kind === "resolved" && result.state).toBe("TAMPERED");
  });

  it("marks a proof/root mismatch TAMPERED", async () => {
    const envelope = decodeEnvelope(routeId);
    envelope.proof[0] = "00".repeat(32);
    const result = await resolveVerification(encodeEnvelope(envelope), chain());
    expect(result.kind === "resolved" && result.state).toBe("TAMPERED");
  });

  it("marks a missing batch TAMPERED", async () => {
    const result = await resolveVerification(routeId, chain({ getBatch: async () => null }));
    expect(result.kind === "resolved" && result.state).toBe("TAMPERED");
  });

  it("reports a claim address without changing validity", async () => {
    const result = await resolveVerification(routeId, chain({ claimOf: async () => "CWALLET" }));
    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.state).toBe("VALID");
      expect(result.claimedBy).toBe("CWALLET");
    }
  });

  it("treats RPC failure as unavailable, never TAMPERED", async () => {
    const result = await resolveVerification(routeId, chain({
      getBatch: async () => { throw new Error("RPC unavailable"); },
    }));
    expect(result).toMatchObject({ kind: "unavailable", state: null });
  });

  it("treats a malformed route id as TAMPERED without reading the chain", async () => {
    let reads = 0;
    const result = await resolveVerification("not-an-envelope", chain({
      getBatch: async () => { reads += 1; return null; },
    }));
    expect(result.kind === "resolved" && result.state).toBe("TAMPERED");
    expect(reads).toBe(0);
  });
});
