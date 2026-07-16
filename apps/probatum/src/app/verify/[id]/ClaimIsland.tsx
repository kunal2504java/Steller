"use client";

import dynamic from "next/dynamic";
import type { CertificateEnvelope } from "../../../lib/certificate";

const InteractiveClaim = dynamic(() => import("./InteractiveClaim"), {
  ssr: false,
  loading: () => (
    <section className="claim-panel" aria-label="Certificate claim" aria-busy="true">
      <span className="claim-loader" aria-hidden="true" />
      <div><p className="claim-kicker">Candela wallet</p><h3>Loading passkey controls</h3></div>
    </section>
  ),
});

export default function ClaimIsland(props: {
  envelope: CertificateEnvelope;
  leafHex: string;
  claimedBy: string | null;
}) {
  return <InteractiveClaim {...props} />;
}
