import Link from "next/link";
import type { ReactNode } from "react";
import deployment from "../../../../../../deployments/testnet.json";
import VerificationShell from "@/components/VerificationShell";
import { bytesToHex } from "@/lib/merkle";
import type { VerificationResult } from "@/lib/verification";

const COPY = {
  VALID: {
    eyebrow: "Proof resolved",
    title: "Valid",
    detail: "Payload and proof match this issuer’s on-chain batch. No revocation entry was found.",
  },
  REVOKED: {
    eyebrow: "Proof resolved",
    title: "Revoked",
    detail: "The proof still matches, but the issuer revoked this batch or certificate leaf on-chain.",
  },
  TAMPERED: {
    eyebrow: "Proof rejected",
    title: "Tampered",
    detail: "The supplied payload or Merkle proof does not match a live anchored batch.",
  },
  UNAVAILABLE: {
    eyebrow: "Check incomplete",
    title: "Unavailable",
    detail: "Stellar testnet did not answer. No validity verdict has been issued—try again shortly.",
  },
} as const;

const STANDARD_STEPS = [
  ["Payload hashed", "Canonical certificate fields recomputed locally."],
  ["Merkle path folded", "Unsigned sorted-pair SHA-256 proof checked against the batch root."],
  ["Chain state read", "Batch, revocation and claim entries read directly from Stellar."],
] as const;

function proofSteps(result: VerificationResult): readonly (readonly [string, string])[] {
  if (result.kind === "unavailable") return [
    STANDARD_STEPS[0],
    STANDARD_STEPS[1],
    ["Chain unavailable", "Stellar did not return enough state to issue a verdict."],
  ];
  if (result.reason === "invalid-envelope") return [
    ["Envelope rejected", "The route is not a valid canonical Probatum certificate envelope."],
    ["Proof not evaluated", "No Merkle claim can be computed from malformed input."],
    ["Verdict withheld", "No chain match or claim state has been asserted."],
  ];
  if (result.reason === "proof-mismatch") return [
    STANDARD_STEPS[0],
    ["Root mismatch", "The folded Merkle proof does not equal the batch root stored on-chain."],
    ["Proof rejected", "Revocation and claim state cannot repair a mismatched proof."],
  ];
  if (result.reason === "missing-batch") return [
    STANDARD_STEPS[0],
    STANDARD_STEPS[1],
    ["Batch not found", "The claimed batch has no live persistent entry on Stellar."],
  ];
  if (result.reason === "revoked") return [
    STANDARD_STEPS[0],
    STANDARD_STEPS[1],
    ["Revocation found", "The matching batch or certificate leaf is marked revoked on-chain."],
  ];
  return STANDARD_STEPS;
}

function short(value: string, start = 10, end = 8) {
  return value.length > start + end + 1
    ? `${value.slice(0, start)}…${value.slice(-end)}`
    : value;
}

function anchorDate(seconds: bigint | undefined) {
  if (seconds == null) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(Number(seconds) * 1_000));
}

function EvidenceRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = <span className="verification-value">{value}</span>;
  return (
    <div className="verification-evidence-row">
      <dt>{label}</dt>
      <dd>{href ? <a href={href} target="_blank" rel="noreferrer">{content}</a> : content}</dd>
    </div>
  );
}

export default function VerificationView({
  result,
  claimSlot,
  shareSlot,
}: {
  result: VerificationResult;
  claimSlot?: ReactNode;
  shareSlot?: ReactNode;
}) {
  const state = result.kind === "unavailable" ? "UNAVAILABLE" : result.state;
  const copy = COPY[state];
  const envelope = result.envelope;
  const batch = result.kind === "resolved" ? result.batch : null;
  const claimedBy = result.kind === "resolved" ? result.claimedBy : null;
  const root = batch ? bytesToHex(batch.root) : null;
  const issuer = batch?.issuer ?? null;
  const contractUrl = `https://stellar.expert/explorer/testnet/contract/${deployment.contractId}`;
  const issuerUrl = issuer ? `https://stellar.expert/explorer/testnet/account/${issuer}` : undefined;
  const claimUrl = claimedBy ? `https://stellar.expert/explorer/testnet/contract/${claimedBy}` : undefined;
  const steps = proofSteps(result);
  const claimLabel = claimedBy
    ? short(claimedBy)
    : state === "TAMPERED" || state === "UNAVAILABLE"
      ? "Not checked"
      : "Unclaimed";
  const disclaimer = state === "VALID" || state === "REVOKED"
    ? "This verifies that the payload and proof match the issuer address’s on-chain batch. It does not independently certify the issuer’s identity or legitimacy."
    : state === "TAMPERED"
      ? "No on-chain match was established. This page does not assert certificate validity or independently certify the named issuer."
      : "No verdict was issued while chain state was unavailable. Retry before relying on this certificate proof.";

  return (
    <VerificationShell state={state}>
      <main className="verification-page">
        <div className="verification-grid" aria-hidden="true" />

        <header className="verification-nav">
          <Link href="/probatum" className="verification-brand" aria-label="Probatum home">
            <span className="verification-mark" aria-hidden="true">
              <svg viewBox="0 0 20 20">
                <path d="M 10 2 L 12 8 L 18 10 L 12 12 L 10 18 L 8 12 L 2 10 L 8 8 Z" />
              </svg>
            </span>
            <span>Probatum</span>
          </Link>
          <span className="verification-network">Stellar testnet · live proof</span>
        </header>

        <section className="verification-stage" aria-labelledby="verification-title">
          <div className="verification-certificate-wrap">
            <article className="verification-certificate">
              <div className="verification-scan" aria-hidden="true" />
              <div className="verification-certificate-topline">
                <span>PROBATUM / VERIFIABLE RECORD</span>
                <span>{envelope ? `BATCH ${String(envelope.batchId).padStart(4, "0")}` : "UNREADABLE"}</span>
              </div>

              {envelope ? (
                <>
                  <div className="verification-certificate-copy">
                    <p>Certificate issued to</p>
                    <h1 id="verification-title">{envelope.payload.recipient}</h1>
                    <p className="verification-award">{envelope.payload.title}</p>
                    <p className="verification-event">{envelope.payload.event}</p>
                  </div>

                  <dl className="verification-certificate-meta">
                    <div><dt>Issued</dt><dd>{envelope.payload.issuedOn}</dd></div>
                    <div><dt>Issuer label</dt><dd>{envelope.payload.issuerLabel}</dd></div>
                    <div><dt>Certificate ID</dt><dd>{envelope.payload.certificateId}</dd></div>
                  </dl>
                </>
              ) : (
                <div className="verification-certificate-copy verification-certificate-empty">
                  <p>Certificate proof</p>
                  <h1 id="verification-title">Unreadable record</h1>
                  <p className="verification-event">The route does not contain a valid Probatum envelope.</p>
                </div>
              )}

              <div className="verification-certificate-footer">
                <div>
                  <span>SEALED ON</span>
                  <strong>STELLAR / TESTNET</strong>
                </div>
                <div className="verification-seal" aria-hidden="true">
                  <span>{state === "VALID" ? "✓" : state === "UNAVAILABLE" ? "·" : "!"}</span>
                </div>
              </div>
            </article>

            <div className="verification-verdict" role="status" aria-live="polite">
              <span className="verification-verdict-dot" aria-hidden="true" />
              <div>
                <p>{copy.eyebrow}</p>
                <strong>{copy.title}</strong>
              </div>
              <span className="verification-time">{result.durationMs.toFixed(0)} ms</span>
            </div>
          </div>

          <aside className="verification-rail" aria-label="On-chain proof details">
            <div className="verification-rail-heading proof-step">
              <p className="eyebrow">Verification result</p>
              <h2>{copy.title}</h2>
              <p>{copy.detail}</p>
            </div>

            <ol className="verification-proof-steps">
              {steps.map(([title, detail], index) => (
                <li className="proof-step" key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{title}</strong><p>{detail}</p></div>
                </li>
              ))}
            </ol>

            <dl className="verification-evidence proof-step">
              <EvidenceRow label="Contract" value={short(deployment.contractId)} href={contractUrl} />
              <EvidenceRow label="Issuer" value={issuer ? short(issuer) : "Not resolved"} href={issuerUrl} />
              <EvidenceRow label="Batch" value={envelope ? `#${envelope.batchId} · ${batch?.count ?? "—"} leaves` : "Not resolved"} />
              <EvidenceRow label="Anchored" value={anchorDate(batch?.anchoredAt)} />
              <EvidenceRow label="Root" value={root ? short(root, 12, 10) : "Not resolved"} />
              <EvidenceRow label="Leaf" value={result.leafHex ? short(result.leafHex, 12, 10) : "Not resolved"} />
              <EvidenceRow
                label="Claim"
                value={claimLabel}
                href={claimUrl}
              />
            </dl>

            <p className="verification-disclaimer proof-step">
              {disclaimer}
            </p>

            {shareSlot && <div className="proof-step">{shareSlot}</div>}

            <div className="verification-actions proof-step">
              {claimSlot ?? (
                <button type="button" className="pill-metal" disabled>
                  Claim unavailable for this proof
                </button>
              )}
              <Link href="/probatum" className="pill-ghost">Back to Probatum</Link>
            </div>
          </aside>
        </section>
      </main>
    </VerificationShell>
  );
}
