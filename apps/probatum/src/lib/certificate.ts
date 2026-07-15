import { sha256 } from "./merkle";

export type CertificatePayload = {
  v: 1;
  certificateId: string;
  recipient: string;
  title: string;
  event: string;
  issuedOn: string;
  issuerLabel: string;
  salt: string;
};

export type CertificateEnvelope = {
  v: 1;
  batchId: number;
  payload: CertificatePayload;
  proof: string[];
};

export type VerificationState = "VALID" | "REVOKED" | "TAMPERED";

export function canonicalCertificate(payload: CertificatePayload): string {
  return JSON.stringify({
    v: payload.v,
    certificateId: payload.certificateId,
    recipient: payload.recipient,
    title: payload.title,
    event: payload.event,
    issuedOn: payload.issuedOn,
    issuerLabel: payload.issuerLabel,
    salt: payload.salt,
  });
}

export function hashCertificate(payload: CertificatePayload) {
  return sha256(new TextEncoder().encode(canonicalCertificate(payload)));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid certificate id");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function assertEnvelope(value: unknown): asserts value is CertificateEnvelope {
  const e = value as CertificateEnvelope;
  if (e?.v !== 1 || !Number.isSafeInteger(e.batchId) || e.batchId < 1 || e.payload?.v !== 1) throw new Error("invalid certificate envelope");
  const fields = [e.payload.certificateId, e.payload.recipient, e.payload.title, e.payload.event, e.payload.issuedOn, e.payload.issuerLabel];
  if (fields.some((field) => typeof field !== "string" || field.length === 0) || !/^[0-9a-f]{32}$/.test(e.payload.salt)) throw new Error("invalid certificate payload");
  if (!Array.isArray(e.proof) || e.proof.some((node) => !/^[0-9a-f]{64}$/.test(node))) throw new Error("invalid certificate proof");
}

export function encodeEnvelope(envelope: CertificateEnvelope): string {
  assertEnvelope(envelope);
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(envelope)));
}

export function decodeEnvelope(id: string): CertificateEnvelope {
  const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(base64UrlDecode(id)));
  assertEnvelope(parsed);
  return parsed;
}
