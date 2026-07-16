import { Buffer } from "buffer";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Keypair } from "@stellar/stellar-base";
import {
  CandelaProvider,
  SignInButton,
  SignUpButton,
  useSubmit,
  useWallet,
  useCandela,
  type BuiltAssembledTransaction,
} from "../src";
import { Client as ProbatumClient } from "./bindings";
import deployment from "../../../deployments/testnet.json";

const CONTRACT_ID =
  (import.meta.env.VITE_CONTRACT_ID as string | undefined) || deployment.contractId;
const FALLBACK_SECRET = import.meta.env.VITE_FALLBACK_SECRET as string;
const STORAGE_KEY = "candela-playground:testnet:wallet";

// The register_issuer tx is built with the SPONSOR as the tx source so the
// sponsor pays the fee (the passkey wallet only supplies the Soroban auth).
// This mirrors the spike EXACTLY (packages/spike/src/main.ts): the ProbatumClient
// is constructed with `publicKey: sponsor.publicKey()`, NOT `undefined`. The
// kit's signAndSubmit() re-simulates in enforcing mode and has the sponsor sign
// the prepared envelope, so the source account must be the sponsor's key.
const SPONSOR_PUBLIC = Keypair.fromSecret(FALLBACK_SECRET).publicKey();

function Demo() {
  const { config } = useCandela();
  const { wallet, isHydrated } = useWallet();
  const { submit, state } = useSubmit();
  const [log, setLog] = useState<string[]>([]);
  const push = (m: string) => setLog((l) => [...l, m]);

  async function profileHash(label: string) {
    return new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`${label}:${wallet!.contractId}`),
      ),
    );
  }

  function client() {
    return new ProbatumClient({
      contractId: CONTRACT_ID,
      networkPassphrase: config.networkPassphrase,
      rpcUrl: config.rpcUrl,
      publicKey: SPONSOR_PUBLIC,
    });
  }

  async function registerIssuer() {
    const at = await client().register_issuer({
      issuer: wallet!.contractId,
      profile_hash: Buffer.from(await profileHash("candela-playground-register")),
    });
    if (!at.built) throw new Error("register_issuer transaction was not assembled");
    const res = await submit(at as unknown as BuiltAssembledTransaction);
    push(`register_issuer-submitted:${res.hash}`);
  }

  async function updateIssuer() {
    const at = await client().update_issuer({
      issuer: wallet!.contractId,
      profile_hash: Buffer.from(await profileHash("candela-playground-update")),
    });
    if (!at.built) throw new Error("update_issuer transaction was not assembled");
    const res = await submit(at as unknown as BuiltAssembledTransaction);
    push(`update_issuer-submitted:${res.hash}`);
  }

  return (
    <main>
      <SignUpButton
        appName="Candela Playground"
        userName="player"
        onWallet={(w) => push(`wallet-deployed:${w.contractId}`)}
      />
      <SignInButton onWallet={(w) => push(`wallet-connected:${w.contractId}`)} />
      <button
        id="register"
        disabled={!wallet}
        onClick={() => registerIssuer().catch((e) => push(`error:${e}`))}
      >
        Register issuer
      </button>
      <button
        id="update"
        disabled={!wallet}
        onClick={() => updateIssuer().catch((e) => push(`error:${e}`))}
      >
        Update issuer
      </button>
      <pre id="hydrated">{String(isHydrated)}</pre>
      <pre id="wallet">{wallet?.contractId ?? "disconnected"}</pre>
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
    storageKey={STORAGE_KEY}
  >
    <Demo />
  </CandelaProvider>,
);
