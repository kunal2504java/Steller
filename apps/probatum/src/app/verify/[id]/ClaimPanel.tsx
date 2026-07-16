"use client";

import { Buffer } from "buffer";
import {
  SignInButton,
  SignUpButton,
  resolveConfig,
  useSubmit,
  useWallet,
  type BuiltAssembledTransaction,
} from "candela-kit";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import deployment from "../../../../../../deployments/testnet.json";
import type { CertificateEnvelope } from "../../../lib/certificate";
import { Client } from "../../../lib/probatum-bindings";

const TESTNET = resolveConfig("testnet");

function short(value: string, start = 10, end = 8) {
  return value.length > start + end + 1
    ? `${value.slice(0, start)}…${value.slice(-end)}`
    : value;
}

function transactionUrl(hash: string) {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export default function ClaimPanel({
  envelope,
  leafHex,
  claimedBy,
}: {
  envelope: CertificateEnvelope;
  leafHex: string;
  claimedBy: string | null;
}) {
  const router = useRouter();
  const { wallet, isConnected, isHydrated, disconnect } = useWallet();
  const { submit, state } = useSubmit();
  const [assemblyError, setAssemblyError] = useState<string | null>(null);
  const [assembling, setAssembling] = useState(false);

  async function claimCertificate() {
    if (!wallet || assembling || state.phase === "signing" || state.phase === "submitting") return;
    setAssemblyError(null);
    setAssembling(true);
    try {
      const client = new Client({
        contractId: deployment.contractId,
        networkPassphrase: TESTNET.networkPassphrase,
        rpcUrl: TESTNET.rpcUrl,
        publicKey: deployment.adminPublic,
      });
      const claimTx = await client.claim({
        recipient: wallet.contractId,
        batch_id: BigInt(envelope.batchId),
        leaf_hash: Buffer.from(leafHex, "hex"),
        proof: envelope.proof.map((node) => Buffer.from(node, "hex")),
      });
      if (!claimTx.built) throw new Error("Stellar did not assemble the claim transaction");
      // The generated binding and candela-kit intentionally compile against
      // different SDK entry points whose AssembledTransaction private fields
      // are nominally incompatible. Validate the shared runtime boundary
      // before crossing it: Candela only requires the built Transaction.
      await submit(claimTx as unknown as BuiltAssembledTransaction);
      router.refresh();
    } catch (error) {
      setAssemblyError(error instanceof Error ? error.message : String(error));
    } finally {
      setAssembling(false);
    }
  }

  if (claimedBy) {
    return (
      <section className="claim-panel claim-panel-complete" aria-label="Certificate claim">
        <p className="claim-kicker">Wallet binding</p>
        <h3>Already claimed</h3>
        <p>This proof is permanently bound to the smart wallet below.</p>
        <a
          className="claim-address"
          href={`https://stellar.expert/explorer/testnet/contract/${claimedBy}`}
          target="_blank"
          rel="noreferrer"
        >
          {short(claimedBy)} <span aria-hidden="true">↗</span>
        </a>
      </section>
    );
  }

  if (!isHydrated) {
    return (
      <section className="claim-panel" aria-label="Certificate claim" aria-busy="true">
        <span className="claim-loader" aria-hidden="true" />
        <div><p className="claim-kicker">Candela wallet</p><h3>Restoring passkey wallet</h3></div>
      </section>
    );
  }

  if (!isConnected || !wallet) {
    return (
      <section className="claim-panel" aria-label="Certificate claim">
        <div className="claim-panel-copy">
          <p className="claim-kicker">Claim with Candela</p>
          <h3>Bind this proof to a passkey</h3>
          <p>Create a Stellar smart wallet with your device passkey. No seed phrase, extension, token or fee.</p>
        </div>
        <div className="claim-entry-actions">
          <SignUpButton
            appName="Probatum"
            userName={`certificate-${envelope.payload.certificateId}`}
            className="pill-metal claim-primary"
          >
            Create passkey wallet
          </SignUpButton>
          <SignInButton className="claim-signin">Sign in instead</SignInButton>
        </div>
        <p className="claim-caveat">Claiming binds this certificate leaf to a wallet address. It mints nothing and creates no tradeable asset.</p>
      </section>
    );
  }

  const busy = assembling || state.phase === "signing" || state.phase === "submitting";
  const failure = assemblyError ?? (state.phase === "failed" ? state.error : null);

  return (
    <section className="claim-panel" aria-label="Certificate claim">
      <div className="claim-panel-copy">
        <p className="claim-kicker">Candela wallet connected</p>
        <h3>{failure ? "Claim failed" : state.phase === "confirmed" ? "Claim confirmed" : "Ready to claim"}</h3>
        <p className="claim-wallet-row">
          <span>{short(wallet.contractId)}</span>
          <button type="button" onClick={disconnect}>Disconnect</button>
        </p>
      </div>

      {state.phase === "confirmed" ? (
        <a className="pill-metal claim-primary" href={transactionUrl(state.hash)} target="_blank" rel="noreferrer">
          View confirmed transaction <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <button
          type="button"
          className="pill-metal claim-primary"
          disabled={busy}
          onClick={claimCertificate}
        >
          {assembling
            ? "Preparing claim…"
            : state.phase === "signing"
              ? "Touch your passkey…"
              : state.phase === "submitting"
                ? "Submitting — fees sponsored…"
                : failure
                  ? "Try claim again"
                  : "Claim this certificate"}
        </button>
      )}

      {failure && <p className="claim-error" role="alert">{failure}</p>}
      <p className="claim-caveat">One on-chain claim is allowed per certificate leaf. Claim only a proof that was privately issued to you.</p>
    </section>
  );
}
