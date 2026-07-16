import { ImageResponse } from "next/og";
import deployment from "../../../../../../deployments/testnet.json";
import { getVerification } from "@/lib/verification";

export const runtime = "nodejs";
export const alt = "Probatum live certificate verification";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function short(value: string) {
  return value.length > 24 ? `${value.slice(0, 14)}…${value.slice(-10)}` : value;
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getVerification(id);
  const state = result.kind === "unavailable" ? "UNAVAILABLE" : result.state;
  const payload = result.envelope?.payload;
  const alert = state === "REVOKED" || state === "TAMPERED";
  const stateColor = alert ? "#d94b68" : state === "VALID" ? "#ffffff" : "#a1a1aa";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 78px",
        color: "#f4f4f5",
        background: "#000000",
        backgroundImage: "radial-gradient(circle at 82% 18%, #202023 0%, #09090b 34%, #000000 68%)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 700 }}>
          <div style={{ width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "#a91f3d" }}>
            <div style={{ width: 11, height: 11, display: "flex", borderRadius: 2, background: "#ffffff", transform: "rotate(45deg)" }} />
          </div>
          Probatum
        </div>
        <div style={{ fontSize: 19, letterSpacing: "0.14em", color: "#a1a1aa" }}>STELLAR TESTNET · LIVE PROOF</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 940 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: stateColor, fontSize: 24, letterSpacing: "0.16em" }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: stateColor }} />
          {state}
        </div>
        <div style={{ fontSize: 68, lineHeight: 1.02, letterSpacing: "-0.045em", fontWeight: 700 }}>
          {payload?.title ?? "Certificate proof"}
        </div>
        <div style={{ fontSize: 32, color: "#c7c7ca" }}>
          {payload ? `${payload.recipient} · ${payload.event}` : "The supplied certificate envelope could not be resolved."}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 26, borderTop: "1px solid #29292d", color: "#8f8f96", fontSize: 18 }}>
        <span>Payload + Merkle proof + revocation checked against Stellar</span>
        <span>{short(deployment.contractId)}</span>
      </div>
    </div>,
    size,
  );
}
