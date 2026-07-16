import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { getVerification } from "@/lib/verification";
import { verificationQrDataUrl } from "@/lib/share";
import { verificationUrl } from "@/lib/site";
import deployment from "../../../../../../deployments/testnet.json";
import ShareActions from "@/components/ShareActions";
import ClaimIsland from "./ClaimIsland";
import VerificationView from "./VerificationView";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getVerification(id);
  const state = result.kind === "unavailable" ? "Verification unavailable" : result.state;
  const certificate = result.envelope?.payload.title ?? "Certificate proof";
  const verifyUrl = verificationUrl(id);
  const description = result.kind === "unavailable"
    ? "Live Stellar verification is temporarily unavailable. No verdict has been issued."
    : `${state}: this certificate proof was checked against live Stellar testnet state.`;
  return {
    title: `${state} · ${certificate} · Probatum`,
    description,
    alternates: { canonical: verifyUrl },
    openGraph: {
      title: `${state} · ${certificate} · Probatum`,
      description,
      type: "website",
      url: verifyUrl,
      images: [{ url: `${verifyUrl}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: `${state} · ${certificate} · Probatum`, description },
  };
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;
  const result = await getVerification(id);
  const verifyUrl = verificationUrl(id);
  const claimSlot = result.kind === "resolved" && result.state === "VALID" && result.envelope && result.leafHex
    ? (
      <ClaimIsland
        envelope={result.envelope}
        leafHex={result.leafHex}
        claimedBy={result.claimedBy}
      />
    )
    : undefined;
  const shareSlot = result.envelope
    ? (
      <ShareActions
        verifyUrl={verifyUrl}
        qrDataUrl={await verificationQrDataUrl(verifyUrl)}
        state={result.kind === "unavailable" ? "UNAVAILABLE" : result.state}
        canShare={Boolean(result.kind === "resolved" && result.claimedBy) || result.envelope.batchId === deployment.demoBatchId}
      />
    )
    : undefined;

  return <VerificationView result={result} claimSlot={claimSlot} shareSlot={shareSlot} />;
}
