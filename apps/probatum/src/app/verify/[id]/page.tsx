import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { getVerification } from "@/lib/verification";
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
  return {
    title: `${state} · ${certificate} · Probatum`,
    description: result.kind === "unavailable"
      ? "Live Stellar verification is temporarily unavailable. No verdict has been issued."
      : `${state}: this certificate proof was checked against live Stellar testnet state.`,
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
  return <VerificationView result={result} />;
}
