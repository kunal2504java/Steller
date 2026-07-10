// The two traps (spike report, task-10): stellar-base for Keypair/
// TransactionBuilder (never /minimal), and always re-simulate after
// kit.sign before fallback submission.
import { PasskeyKit, PasskeyServer } from "passkey-kit";
import { Keypair, TransactionBuilder } from "@stellar/stellar-base";
import {
  Server,
  Api,
  assembleTransaction,
} from "@stellar/stellar-sdk/minimal/rpc";
import type { CandelaConfig } from "./config";

export type CandelaWallet = { contractId: string; keyIdBase64: string };

// passkey-kit's `PasskeyKit.sign()` unconditionally reads
// `this.wallet!.options.contractId` (kit.ts ~L452), and `this.wallet` is
// ONLY ever set as a side effect of `createWallet()` (~L93) or
// `connectWallet()` (~L221) running on THAT SAME instance. A fresh
// `new PasskeyKit(...)` per call therefore throws on every `sign()`. Memoize
// one instance per (rpcUrl, networkPassphrase, walletWasmHash) so a
// same-session create->sign flow reuses the instance that ran createWallet,
// and so a hydrated (via connectWallet, see signAndSubmit below) instance
// stays hydrated for later calls in the same session.
const kitCache = new Map<string, PasskeyKit>();

function kitFor(cfg: CandelaConfig): PasskeyKit {
  const cacheKey = `${cfg.rpcUrl}|${cfg.networkPassphrase}|${cfg.walletWasmHash}`;
  let kit = kitCache.get(cacheKey);
  if (!kit) {
    kit = new PasskeyKit({
      rpcUrl: cfg.rpcUrl,
      networkPassphrase: cfg.networkPassphrase,
      walletWasmHash: cfg.walletWasmHash,
    });
    kitCache.set(cacheKey, kit);
  }
  return kit;
}

async function waitForTx(server: Server, hash: string) {
  for (let i = 0; i < 30; i++) {
    const res = await server.getTransaction(hash);
    if (res.status !== "NOT_FOUND") return res;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`timeout waiting for tx ${hash}`);
}

/** Fee-bump `inner` with the sponsor and submit. Copied from the spike. */
async function feeBumpAndSubmit(
  cfg: CandelaConfig,
  inner: any,
): Promise<{ hash: string; status: string }> {
  if (!cfg.sponsorSecret) throw new Error("no launchtube and no sponsorSecret");
  const server = new Server(cfg.rpcUrl);
  const sponsor = Keypair.fromSecret(cfg.sponsorSecret);
  const resourceFee = BigInt(
    inner.toEnvelope().v1().tx().ext().value()?.resourceFee().toString() ?? 0,
  );
  let baseFee = (BigInt(inner.fee) - resourceFee) / BigInt(inner.operations.length);
  if (baseFee < 100n) baseFee = 100n;
  const fb = TransactionBuilder.buildFeeBumpTransaction(
    sponsor.publicKey(),
    baseFee.toString(),
    inner,
    cfg.networkPassphrase,
  );
  fb.sign(sponsor);
  const sent = await server.sendTransaction(fb as any);
  if (sent.status === "ERROR") {
    throw new Error("fee-bump submission rejected: " + JSON.stringify(sent));
  }
  const res = await waitForTx(server, sent.hash);
  if (res.status !== "SUCCESS") {
    throw new Error("fee-bump failed on-chain: " + JSON.stringify(res));
  }
  return { hash: sent.hash, status: res.status };
}

async function send(cfg: CandelaConfig, signedTx: any) {
  if (cfg.launchtube) {
    const server = new PasskeyServer({
      rpcUrl: cfg.rpcUrl,
      launchtubeUrl: cfg.launchtube.url,
      launchtubeJwt: cfg.launchtube.jwt,
    });
    const res = await server.send(signedTx);
    // Defensive, best-effort check: passkey-kit's PasskeyServer.send() already
    // throws the response body when the Launchtube HTTP call itself is
    // non-2xx (server.ts `send()`), but a 200 can still carry an
    // error-shaped JSON payload. The spike never exercised a reachable
    // Launchtube instance, so this branch is untested against a live
    // service — revisit the exact error shape once we can test against one.
    if (
      res &&
      typeof res === "object" &&
      ("error" in res ||
        "errorResult" in res ||
        (res as any).status === "ERROR" ||
        (res as any).status === "FAILED")
    ) {
      throw new Error("launchtube submission failed: " + JSON.stringify(res));
    }
    return res;
  }
  return feeBumpAndSubmit(cfg, signedTx);
}

export async function createWallet(
  cfg: CandelaConfig,
  appName: string,
  userName: string,
): Promise<CandelaWallet> {
  const kit = kitFor(cfg);
  const res = await kit.createWallet(appName, userName);
  await send(cfg, res.signedTx);
  return { contractId: res.contractId, keyIdBase64: res.keyIdBase64 };
}

export async function connectWallet(cfg: CandelaConfig): Promise<CandelaWallet> {
  const kit = kitFor(cfg);
  const res = await kit.connectWallet();
  return { contractId: res.contractId, keyIdBase64: res.keyIdBase64 };
}

/**
 * Sign an assembled contract call with the passkey wallet, then submit
 * with the sponsor paying. `assembled` is a bindings-client AssembledTransaction.
 */
export async function signAndSubmit(
  cfg: CandelaConfig,
  wallet: CandelaWallet,
  assembled: any,
): Promise<{ hash: string; status: string }> {
  const kit = kitFor(cfg);
  if (kit.wallet == null) {
    // Page-reload session: this (possibly memoized) kit instance never ran
    // createWallet()/connectWallet(), so `kit.wallet` is still unset and
    // `kit.sign()` would throw. Hydrate it by re-deriving the wallet client
    // from the already-known keyId.
    //
    // Confirmed from installed passkey-kit@0.11.3 source
    // (node_modules/.pnpm/passkey-kit@0.11.3/**/src/kit.ts, connectWallet()
    // ~L157-233): `connectWallet({ keyId })` accepts `keyId` as either a
    // base64url string or raw Uint8Array (CandelaWallet.keyIdBase64 is the
    // former). Passing a keyId SKIPS the WebAuthn/biometric prompt — the
    // `startAuthentication()` call only happens `if (!keyId)` (~L169).
    // With a keyId supplied, connectWallet instead deterministically
    // re-derives the contract id from (internal walletPublicKey, keyId) and
    // confirms it on-chain via `rpc.getContractData` — no user interaction.
    // The user is still prompted for biometrics later, inside kit.sign() ->
    // signAuthEntry() -> WebAuthn.startAuthentication().
    await kit.connectWallet({ keyId: wallet.keyIdBase64 });
  }
  await kit.sign(assembled, { keyId: wallet.keyIdBase64 });
  const server = new Server(cfg.rpcUrl);
  // enforcing-mode re-simulation so __check_auth is priced (trap #2)
  const sim = await server.simulateTransaction(assembled.built);
  if (!Api.isSimulationSuccess(sim)) {
    throw new Error("re-simulation failed: " + JSON.stringify(sim));
  }
  const prepared = assembleTransaction(assembled.built, sim).build();
  if (!cfg.sponsorSecret) throw new Error("sponsorSecret required for fallback path");
  const sponsor = Keypair.fromSecret(cfg.sponsorSecret);
  prepared.sign(sponsor as any);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error("submission rejected: " + JSON.stringify(sent));
  }
  const res = await waitForTx(server, sent.hash);
  if (res.status !== "SUCCESS") {
    throw new Error("failed on-chain: " + JSON.stringify(res));
  }
  return { hash: sent.hash, status: res.status };
}
