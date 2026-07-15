import { describe, expect, it } from "vitest";
import { decodeEnvelope, encodeEnvelope, hashCertificate, type CertificateEnvelope } from "../certificate";
import { bytesToHex } from "../merkle";
import { foldProof, hexToBytes } from "../merkle";
import fixture from "../../../../../fixtures/probatum-testnet-demo.json";

const envelope: CertificateEnvelope = {
  v: 1,
  batchId: 2,
  payload: {
    v: 1,
    certificateId: "demo-01",
    recipient: "Build Station Demo Recipient",
    title: "Proof of Completion",
    event: "Probatum Testnet Demo",
    issuedOn: "2026-07-16",
    issuerLabel: "Probatum Testnet Issuer",
    salt: "00112233445566778899aabbccddeeff",
  },
  proof: ["11".repeat(32), "22".repeat(32)],
};

describe("certificate envelope", () => {
  it("round-trips as self-contained base64url", () => {
    expect(decodeEnvelope(encodeEnvelope(envelope))).toEqual(envelope);
  });

  it("binds recipient, title, and salt into the leaf", async () => {
    const original = bytesToHex(await hashCertificate(envelope.payload));
    for (const payload of [
      { ...envelope.payload, recipient: "Changed" },
      { ...envelope.payload, title: "Changed" },
      { ...envelope.payload, salt: "ff".repeat(16) },
    ]) {
      expect(bytesToHex(await hashCertificate(payload))).not.toBe(original);
    }
  });

  it("rejects malformed envelopes", () => {
    expect(() => decodeEnvelope("not-base64url!" )).toThrow();
  });

  it("pins every committed demo envelope to the fixture root", async () => {
    for (const certificate of fixture.certificates) {
      const decoded = decodeEnvelope(certificate.routeId);
      const leaf = await hashCertificate(decoded.payload);
      expect(bytesToHex(leaf)).toBe(certificate.leaf);
      expect(bytesToHex(await foldProof(leaf, decoded.proof.map(hexToBytes)))).toBe(fixture.root);
    }
  });
});
