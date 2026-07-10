import { Buffer } from "buffer";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Keypair } from "@stellar/stellar-base";
import {
  CandelaProvider,
  SignUpButton,
  useSubmit,
  useWallet,
  useCandela,
} from "../src";
import { Client as ProbatumClient } from "./bindings";
import deployment from "../../../deployments/testnet.json";

const CONTRACT_ID =
  (import.meta.env.VITE_CONTRACT_ID as string | undefined) || deployment.contractId;
const FALLBACK_SECRET = import.meta.env.VITE_FALLBACK_SECRET as string;

// The register_issuer tx is built with the SPONSOR as the tx source so the
// sponsor pays the fee (the passkey wallet only supplies the Soroban auth).
// This mirrors the spike EXACTLY (packages/spike/src/main.ts): the ProbatumClient
// is constructed with `publicKey: sponsor.publicKey()`, NOT `undefined`. The
// kit's signAndSubmit() re-simulates in enforcing mode and has the sponsor sign
// the prepared envelope, so the source account must be the sponsor's key.
const SPONSOR_PUBLIC = Keypair.fromSecret(FALLBACK_SECRET).publicKey();

function Demo() {
  const { config } = useCandela();
  const { wallet } = useWallet();
  const { submit, state } = useSubmit();
  const [log, setLog] = useState<string[]>([]);
  const push = (m: string) => setLog((l) => [...l, m]);

  async function registerIssuer() {
    const profileHash = new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode("candela-playground"),
      ),
    );
    const probatum = new ProbatumClient({
      contractId: CONTRACT_ID,
      networkPassphrase: config.networkPassphrase,
      rpcUrl: config.rpcUrl,
      publicKey: SPONSOR_PUBLIC,
    });
    const at = await probatum.register_issuer({
      issuer: wallet!.contractId,
      profile_hash: Buffer.from(profileHash),
    });
    const res = await submit(at);
    push(`register_issuer-submitted:${res.hash}`);
  }

  return (
    <main>
      <SignUpButton
        appName="Candela Playground"
        userName="player"
        onWallet={(w) => push(`wallet-deployed:${w.contractId}`)}
      />
      <button
        id="register"
        disabled={!wallet}
        onClick={() => registerIssuer().catch((e) => push(`error:${e}`))}
      >
        Register issuer
      </button>
      <pre id="log">{log.join("\n")}</pre>
      <pre id="state">{state.phase}</pre>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <CandelaProvider
    network={{
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
      walletWasmHash:
        "ecd990f0b45ca6817149b6175f79b32efb442f35731985a084131e8265c4cd90",
      sponsorSecret: import.meta.env.VITE_FALLBACK_SECRET as string,
    }}
  >
    <Demo />
  </CandelaProvider>,
);
