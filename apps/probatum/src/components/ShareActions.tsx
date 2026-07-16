import { linkedInShareUrl } from "@/lib/site";
import type { VerificationState } from "@/lib/certificate";

export default function ShareActions({
  verifyUrl,
  qrDataUrl,
  state,
  canShare,
}: {
  verifyUrl: string;
  qrDataUrl: string;
  state: VerificationState | "UNAVAILABLE";
  canShare: boolean;
}) {
  return (
    <section className="share-panel" aria-label="Share certificate proof">
      <div className="share-qr">
        {/* Generated server-side from verifyUrl; a plain img is correct for a data URI. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="QR code for this certificate verification link" width={120} height={120} />
      </div>
      <div className="share-copy">
        <p className="claim-kicker">Proof travels</p>
        <h3>{canShare ? "Share the live verdict" : "Claim before sharing"}</h3>
        <p>
          {canShare
            ? `The LinkedIn card opens this ${state} proof—not a screenshot.`
            : "Unclaimed recipient links are bearer proofs. Keep this one private until its intended wallet claims it."}
        </p>
        {canShare ? (
          <a
            className="pill-metal share-linkedin"
            href={linkedInShareUrl(verifyUrl)}
            target="_blank"
            rel="noreferrer"
          >
            Share on LinkedIn <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <button type="button" className="pill-metal share-linkedin" disabled>
            LinkedIn unlocks after claim
          </button>
        )}
      </div>
    </section>
  );
}
