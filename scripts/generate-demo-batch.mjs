import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const payloads = [
  ["demo-01", "Build Station Demo Recipient", "Proof of Completion", "00112233445566778899aabbccddeeff"],
  ["demo-02", "Candela Passkey Demo", "Passkey Claim Proof", "102132435465768798a9bacbdcedfe0f"],
  ["demo-03", "Stellar Testnet Participant", "Verifiable Credential Demo", "2031425364758697a8b9cadbecfd0e1f"],
  ["demo-04", "Probatum Verification Demo", "On-chain Proof Demo", "30415263748596a7b8c9daebfc0d1e2f"],
].map(([certificateId, recipient, title, salt]) => ({
  v: 1,
  certificateId,
  recipient,
  title,
  event: "Probatum Testnet Demo",
  issuedOn: "2026-07-16",
  issuerLabel: "Probatum Testnet Issuer",
  salt,
}));

const canonical = (p) => JSON.stringify({ v: p.v, certificateId: p.certificateId, recipient: p.recipient, title: p.title, event: p.event, issuedOn: p.issuedOn, issuerLabel: p.issuerLabel, salt: p.salt });
const hash = (bytes) => createHash("sha256").update(bytes).digest();
const pair = (a, b) => hash(Buffer.concat(Buffer.compare(a, b) <= 0 ? [a, b] : [b, a]));
const leaves = payloads.map((payload) => hash(Buffer.from(canonical(payload))));
const branches = [pair(leaves[0], leaves[1]), pair(leaves[2], leaves[3])];
const root = pair(branches[0], branches[1]);
const proofs = [
  [leaves[1], branches[1]], [leaves[0], branches[1]],
  [leaves[3], branches[0]], [leaves[2], branches[0]],
];
const certificates = payloads.map((payload, index) => {
  const envelope = { v: 1, batchId: 2, payload, proof: proofs[index].map((node) => node.toString("hex")) };
  return { routeId: Buffer.from(JSON.stringify(envelope)).toString("base64url"), leaf: leaves[index].toString("hex"), ...envelope };
});
const output = `${JSON.stringify({ version: 1, batchId: 2, count: certificates.length, root: root.toString("hex"), certificates }, null, 2)}\n`;
const target = resolve("fixtures/probatum-testnet-demo.json");
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== output) throw new Error("demo fixture is stale");
} else {
  writeFileSync(target, output, "utf8");
}
