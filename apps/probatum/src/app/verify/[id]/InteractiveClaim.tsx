"use client";

import CandelaClaimProvider from "../../../components/CandelaClaimProvider";
import type { CertificateEnvelope } from "../../../lib/certificate";
import ClaimPanel from "./ClaimPanel";

export default function InteractiveClaim(props: {
  envelope: CertificateEnvelope;
  leafHex: string;
  claimedBy: string | null;
}) {
  return (
    <CandelaClaimProvider>
      <ClaimPanel {...props} />
    </CandelaClaimProvider>
  );
}
