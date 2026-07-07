// Candela passkey + sponsored-submission spike.
//
// Proves, against the deployed Probatum testnet contract, that:
//   (a) a passkey creates a Stellar smart wallet (deployed on testnet),
//   (b) that wallet signs register_issuer on our contract, and
//   (c) fees are paid by a sponsor, NOT the passkey wallet.
//
// Launchtube (the intended fee-sponsor relay) is UNREACHABLE from this machine
// (testnet.launchtube.xyz + the launchtube.xyz apex both fail DNS resolution),
// so the *working* submission path here is the local fallback: a funded sponsor
// key pays via (a) a fee-bump wrapping the passkey-kit deploy tx and (b) acting
// as the source/fee-payer of the register_issuer tx while the passkey supplies
// the Soroban authorization. The Launchtube code path is still wired (guarded by
// VITE_LAUNCHTUBE_JWT) so Candela can wrap it once a reachable relay exists.

import { Buffer } from "buffer";
import { PasskeyKit, PasskeyServer } from "passkey-kit";
// NOTE: import Keypair/TransactionBuilder from @stellar/stellar-base (NOT from
// @stellar/stellar-sdk/minimal). The `/minimal` browser entry is a self-contained
// UMD bundle with its OWN copy of stellar-base+js-xdr; passkey-kit's deploy tx and
// the rpc/contract lib code use the standalone @stellar/stellar-base. Mixing the
// two copies makes XDR objects fail cross-copy type checks ("... is not a O").
import { Keypair, TransactionBuilder } from "@stellar/stellar-base";
import type { Tx } from "@stellar/stellar-sdk/minimal/contract";
import {
  Server as RpcServer,
  Api as RpcApi,
  assembleTransaction,
} from "@stellar/stellar-sdk/minimal/rpc";
import { Client as ProbatumClient } from "./bindings/probatum/src";

const RPC_URL = import.meta.env.VITE_RPC_URL;
const NETWORK_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE;
const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID;
const WALLET_WASM_HASH = import.meta.env.VITE_WALLET_WASM_HASH;
const LAUNCHTUBE_URL = import.meta.env.VITE_LAUNCHTUBE_URL;
const LAUNCHTUBE_JWT = import.meta.env.VITE_LAUNCHTUBE_JWT;
const FALLBACK_SECRET = import.meta.env.VITE_FALLBACK_SECRET;

const logEl = document.querySelector("#log")!;
const log = (m: unknown) => {
  // eslint-disable-next-line no-console
  console.log(m);
  logEl.textContent +=
    (typeof m === "string" ? m : JSON.stringify(m, null, 2)) + "\n";
};

const server = new RpcServer(RPC_URL);
const sponsor = Keypair.fromSecret(FALLBACK_SECRET);

const kit = new PasskeyKit({
  rpcUrl: RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
  walletWasmHash: WALLET_WASM_HASH,
});

// Launchtube relay — only constructed when a JWT is supplied. Left unused when
// Launchtube is unreachable (the current situation); present so Candela can wrap
// server.send(...) the moment a reachable relay/token is available.
const launchtube =
  LAUNCHTUBE_JWT && LAUNCHTUBE_URL
    ? new PasskeyServer({
        rpcUrl: RPC_URL,
        launchtubeUrl: LAUNCHTUBE_URL,
        launchtubeJwt: LAUNCHTUBE_JWT,
      })
    : undefined;

// Expose state for the Playwright regression + report evidence.
const spikeState: Record<string, unknown> = {};
(window as unknown as { __spike: unknown }).__spike = spikeState;

let walletId: string | undefined;
let keyIdBase64: string | undefined;

const expert = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;

/** Poll RPC until a submitted transaction is no longer NOT_FOUND. */
async function waitForTx(hash: string) {
  for (let i = 0; i < 40; i++) {
    const r = await server.getTransaction(hash);
    if (r.status !== "NOT_FOUND") return r;
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`tx ${hash} not confirmed within 40s`);
}

/**
 * FALLBACK submit #1 (fee-bump): wrap an already-signed inner tx (e.g. the
 * passkey-kit smart-wallet deploy, sourced+signed by passkey-kit's deterministic
 * deploy account) in a fee-bump whose fee source is our funded sponsor. The
 * sponsor pays; the passkey wallet pays nothing.
 */
async function feeBumpAndSubmit(inner: Tx) {
  const sorobanData = inner.toEnvelope().v1().tx().ext().value();
  const resourceFee = sorobanData
    ? BigInt(sorobanData.resourceFee().toString())
    : 0n;
  const innerOps = BigInt(inner.operations.length);
  let baseFee = (BigInt(inner.fee) - resourceFee) / innerOps;
  if (baseFee < 100n) baseFee = 100n;
  log({ step: "fee-bump-build", innerFee: inner.fee, resourceFee: resourceFee.toString(), baseFee: baseFee.toString() });

  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    sponsor.publicKey(),
    baseFee.toString(),
    inner as never,
    NETWORK_PASSPHRASE,
  );
  log({ step: "fee-bump-built", feeBumpFee: feeBump.fee });
  feeBump.sign(sponsor);
  log({ step: "fee-bump-signed" });

  const sent = await server.sendTransaction(feeBump);
  if (sent.status === "ERROR") {
    throw new Error("fee-bump send ERROR: " + JSON.stringify(sent));
  }
  const res = await waitForTx(sent.hash);
  if (res.status !== "SUCCESS") {
    throw new Error("fee-bump failed on-chain: " + JSON.stringify(res));
  }
  return { hash: sent.hash, status: res.status };
}

/**
 * FALLBACK submit #2 (sponsor as source): the register_issuer tx is built with
 * the sponsor as the transaction source (so the sponsor pays the fee); the
 * passkey wallet only supplies the Soroban auth entry. `at.built` already
 * carries the passkey-signed auth (from kit.sign) — but its resources come from
 * the initial *recording* simulation, which does NOT run the smart wallet's
 * secp256r1 __check_auth. We therefore RE-SIMULATE in enforcing mode (Launchtube
 * does the equivalent server-side) to price __check_auth, re-assemble preserving
 * the signed auth, then the sponsor signs the envelope and submits.
 */
async function sponsoredSubmit(at: { built: Tx }) {
  const builtFeeFromRecordingSim = at.built.fee;
  const sim = await server.simulateTransaction(at.built);
  if (!RpcApi.isSimulationSuccess(sim)) {
    throw new Error("re-simulation failed: " + JSON.stringify(sim));
  }
  const prepared = assembleTransaction(at.built, sim).build();
  log({
    step: "register-resimulated",
    builtFeeFromRecordingSim,
    minResourceFee: sim.minResourceFee,
    inclusionFeeAfterAssemble: prepared.fee,
    note: "re-simulated in ENFORCING mode with the passkey-signed auth (Launchtube does the equivalent server-side); footprint + resource fee recomputed to cover the secp256r1 __check_auth",
  });
  prepared.sign(sponsor);

  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error("register send ERROR: " + JSON.stringify(sent));
  }
  const res = await waitForTx(sent.hash);
  if (res.status !== "SUCCESS") {
    throw new Error("register_issuer failed on-chain: " + JSON.stringify(res));
  }
  return { hash: sent.hash, sourceAccount: prepared.source };
}

document.querySelector("#create")!.addEventListener("click", async () => {
  const btn = document.querySelector("#create") as HTMLButtonElement;
  btn.disabled = true;
  try {
    log({ step: "creating-passkey-wallet" });
    const res = await kit.createWallet("Candela Spike", "spike-user");
    walletId = res.contractId;
    keyIdBase64 = res.keyIdBase64;
    spikeState.walletId = walletId;
    spikeState.keyIdBase64 = keyIdBase64;
    log({ step: "wallet-created", contractId: res.contractId });

    // Deploy the smart wallet. Launchtube would be: await launchtube.send(res.signedTx)
    // Fallback: sponsor fee-bumps the passkey-kit-signed deploy tx.
    const deploy = await feeBumpAndSubmit(res.signedTx as unknown as Tx);
    spikeState.deployHash = deploy.hash;
    log({
      step: "wallet-deployed",
      via: launchtube ? "launchtube-available-but-fallback-used" : "fee-bump-fallback",
      deployTx: deploy.hash,
      deployStatus: deploy.status,
      link: expert(deploy.hash),
    });

    (document.querySelector("#register") as HTMLButtonElement).disabled = false;
  } catch (e) {
    log({ step: "create-ERROR", error: String((e as Error).message || e), stack: String((e as Error).stack || "").split("\n").slice(0, 6).join(" | ") });
    btn.disabled = false;
    throw e;
  }
});

document.querySelector("#register")!.addEventListener("click", async () => {
  const btn = document.querySelector("#register") as HTMLButtonElement;
  btn.disabled = true;
  try {
    const profileHash = Buffer.from(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode("spike-profile"),
      ),
    );
    spikeState.profileHashHex = profileHash.toString("hex");
    log({ step: "register-building", issuer: walletId, profileHashHex: profileHash.toString("hex") });

    // Build register_issuer with the SPONSOR as tx source (sponsor pays fees).
    const probatum = new ProbatumClient({
      contractId: CONTRACT_ID,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
      publicKey: sponsor.publicKey(),
    });
    const at = await probatum.register_issuer({
      issuer: walletId!,
      profile_hash: profileHash,
    });

    // Passkey wallet authorizes (WebAuthn secp256r1 signature on the auth entry).
    await kit.sign(at, { keyId: keyIdBase64 });
    log({ step: "register-authorized-by-passkey" });

    // Submit via fallback (Launchtube would be: await launchtube.send(at)).
    const out = await sponsoredSubmit(at as unknown as { built: Tx });
    spikeState.registerHash = out.hash;
    spikeState.feePayer = out.sourceAccount;
    log({
      step: "register_issuer-submitted",
      registerTx: out.hash,
      feePaidBy: out.sourceAccount,
      isSponsor: out.sourceAccount === sponsor.publicKey(),
      link: expert(out.hash),
    });
    log({ step: "DONE", walletId, sponsor: sponsor.publicKey() });
  } catch (e) {
    log({ step: "register-ERROR", error: String((e as Error).message || e) });
    btn.disabled = false;
    throw e;
  }
});

log({
  step: "ready",
  contract: CONTRACT_ID,
  walletWasmHash: WALLET_WASM_HASH,
  sponsor: sponsor.publicKey(),
  launchtube: launchtube ? "configured" : "unreachable/unconfigured (fallback only)",
});
