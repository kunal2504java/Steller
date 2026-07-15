# Contract v3 + Probatum Viral Loop Implementation Plan

**Status:** proposed 2026-07-16; implementation must not begin until this plan is accepted.

**Goal:** Ship one coordinated testnet revision: harden Probatum contract v3, deploy it exactly once through the constructor path, preserve the KAT genesis proof, and deliver a real public verify → passkey claim → LinkedIn share loop built on `candela-kit`.

**Architecture:** Contract v3 extends instance/code TTL on every committed write path and `bump_batch`, bumps the parent batch on a successful claim, indexes `PauseToggled.paused`, and removes repeated revocation-key construction without changing the append-only Error ABI or claim guard order. The redeploy seeds batch #1 with the unchanged KAT root and batch #2 with deterministic salted demo-certificate envelopes. Batch #2 is necessary because the KAT leaves are dummy byte vectors, not hashes of certificate content; pretending otherwise would make “tamper detection” false. The Probatum route decodes a self-contained envelope, canonicalizes and hashes it, verifies its unsigned sorted-pair proof against the live on-chain root, then checks revocation/claim state. Candela gains a typed assembled-transaction boundary, observable signing phase, persisted wallet restoration, identity assertions, and a same-origin submission transport so the sponsor secret stays server-only.

**Tech stack:** existing pinned Rust/Soroban toolchain; Next 15.5.6; React 19.2.0; TypeScript ^5.9.3; `@stellar/stellar-sdk` 14.6.1; `@stellar/stellar-base` 14.1.0; `passkey-kit` 0.11.3; Vitest 2; Playwright; `qrcode` 1.5.4 + `@types/qrcode` 1.5.6.

## Non-negotiable execution rules

- Exactly one coordinated deployment of the v3 contract. Local Rust tests and Wasm builds are unlimited; do not run `scripts/deploy-testnet.ps1` until Tasks 1–3 are green and reviewed.
- Preserve `Error` discriminants 1–11 exactly and append only if a genuinely new error is required (none is planned).
- Preserve claim guard order: paused → auth → batch exists → batch revoked → leaf revoked → already claimed → proof.
- `deployments/testnet.json` remains the only contract/deployment source of truth. Generated bindings must not retain a generated `networks.testnet.contractId` constant.
- The KAT root remains exactly `57c49ece895537b2bf5dfe5ba421bbf7666f12a00d28a81c29ba0faa52cd1902` as batch #1.
- Merkle pair hashing is `sha256(min || max)` with unsigned bytewise lexicographic comparison. Never compare hex with locale rules and never concatenate text.
- No sponsor secret in browser code, fixtures, reports, commits, test snapshots, or tool output. Runtime server code reads `PROBATUM_SPONSOR_SECRET` from a gitignored environment file/process only.
- No fiat/INR, custody, tradeable assets, Aadhaar, or PII on-chain. Demo certificate identities are explicitly synthetic testnet labels; real recipient data lives only in the self-contained link a recipient chooses to share.
- `candela-kit` stays unpublished. This plan does not run `npm publish`.
- Inter + Fragment Mono only. Colour remains limited to the wax mark and functional VALID/REVOKED/TAMPERED states. Every motion has a complete reduced-motion frame.
- Before every `next build`, confirm no Probatum dev server/orphan owns port 3000.
- Each logic task follows red → green: add the test, run it and record the expected failure, implement, rerun the focused test and the whole relevant suite, then commit only that task.
- Preserve the user-owned untracked `.claude/` directory; never stage it.

## Product and visual direction

**Visual thesis:** a live notary seal suspended over true black—cold silver proof geometry, one wax-red failure accent, and a certificate artifact that feels physical without becoming decorative theatre.

**Content plan:** (1) immediate verdict + certificate identity, (2) the certificate artifact, (3) a compact proof rail showing leaf → merkle root → Stellar state, (4) claim/share actions, (5) a restrained “Issue with Probatum” loop closer. This is an operational verification surface, not a second marketing homepage.

**Interaction thesis:** the resolved server verdict enters as a short three-step scan; the wax seal settles once; claim moves visibly through passkey signing → sponsored submission → confirmed. Proof rows and share/QR affordances get restrained hover/reveal transitions. Under reduced motion all elements render at their final state with no scan, spin, pulse, or delayed opacity.

## Public interfaces added or changed

```ts
// packages/candela-kit/src/core/wallet.ts
export type BuiltAssembledTransaction<T = unknown> =
  AssembledTransaction<T> & { built: Transaction };

export type SignAndSubmitOptions = {
  onSigned?: () => void;
};

export async function signAndSubmit<T>(
  cfg: CandelaConfig,
  wallet: CandelaWallet,
  assembled: BuiltAssembledTransaction<T>,
  options?: SignAndSubmitOptions,
): Promise<{ hash: string; status: string }>;
```

```ts
// packages/candela-kit/src/core/config.ts
export type CandelaConfig = {
  rpcUrl: string;
  networkPassphrase: string;
  walletWasmHash: string;
  launchtube?: { url: string; jwt: string };
  sponsorSecret?: string;       // local/test fallback only
  submissionUrl?: string;       // same-origin server transport
};
```

```tsx
<CandelaProvider
  network="testnet"
  submissionUrl="/api/candela/submit"
  storageKey="probatum:testnet:wallet"
>
  {children}
</CandelaProvider>
```

```ts
// apps/probatum/src/lib/certificate.ts
export type CertificatePayload = {
  v: 1;
  certificateId: string;
  recipient: string;
  title: string;
  event: string;
  issuedOn: string;
  issuerLabel: string;
  salt: string;
};

export type CertificateEnvelope = {
  v: 1;
  batchId: number;
  payload: CertificatePayload;
  proof: string[]; // lowercase 32-byte hex siblings
};

export type VerificationState = "VALID" | "REVOKED" | "TAMPERED";
```

## Task 0: Accept and commit this plan

**Files:**
- Add: `docs/superpowers/plans/2026-07-16-plan-4-contract-v3-and-probatum-viral-loop.md`

- [ ] Review the direction decisions: indexed pause boolean; separate truthful demo batch; self-contained salted envelope; server-only sponsor transport.
- [ ] After acceptance, commit only this file:

```powershell
git add docs/superpowers/plans/2026-07-16-plan-4-contract-v3-and-probatum-viral-loop.md
git commit -m "docs(plan-4): contract v3 and Probatum viral-loop implementation plan"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

## Task 1: Contract v3 instance/code TTL

**Files:**
- Modify: `contracts/probatum/src/lib.rs`
- Modify: `contracts/probatum/src/test.rs`

**Decision:** use one helper and call it after successful constructor/write state changes plus `bump_batch`. Read-only simulations cannot durably extend TTL, so adding it to views would create misleading code. The explicit `bump_batch` entrypoint remains the public keeper.

- [ ] Import `soroban_sdk::testutils::storage::Instance as _` in tests and change version assertions from 2 to 3.
- [ ] Add a fail-first test that advances the ledger until the instance TTL is below `TTL_THRESHOLD`, calls `pause`, and asserts `env.as_contract(&client.address, || env.storage().instance().get_ttl()) >= TTL_EXTEND_TO - 1`.
- [ ] Run `cargo test --manifest-path contracts/Cargo.toml test_write_refreshes_instance_ttl`; expected failure: TTL remains below the extension target.
- [ ] Implement:

```rust
fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}
```

- [ ] Call it from `__constructor`, `pause`, `register_issuer`, `update_issuer`, `anchor_batch`, `revoke_batch`, `revoke_leaf`, successful `claim`, and `bump_batch`. Do not move guard checks or extend TTL on failed calls.
- [ ] Change `version()` to `3`; run focused test, then `pnpm test:contract` and `pnpm build:contract`.
- [ ] Commit: `feat(contract): v3 extends instance and code TTL on writes`.

## Task 2: Contract claim retention, pause indexing, revocation-key hoist, and pause gates

**Files:**
- Modify: `contracts/probatum/src/lib.rs`
- Modify: `contracts/probatum/src/test.rs`

**Decision:** `PauseToggled.paused` becomes `#[topic]`. Consumers query state transitions by boolean; the event then has topics `(pause_toggled, paused)` and Void data. For `revoke_leaf`, hoist `batch_key` and `revoked_key` once. Soroban cannot partially deserialize a `Batch`; adding a second permanent issuer-index entry only to avoid one decode would violate the one-entry-per-batch storage discipline.

- [ ] Add fail-first exact event assertion using `Events`, `IntoVal`, `symbol_short!`, and `vec!`; assert `(symbol_short!("pause_toggled"), true)` in topics and `()` as data.
- [ ] Add fail-first `test_claim_refreshes_parent_batch_ttl`: anchor a valid four-leaf batch, advance until its persistent TTL is below threshold, claim, then inspect `DataKey::Batch(batch_id)` TTL inside `env.as_contract` and expect extension to `TTL_EXTEND_TO`.
- [ ] Add three pause-gating tests: paused `anchor_batch`, `claim`, and both revoke entrypoints return contract Error #2. Existing register pause coverage remains.
- [ ] Run each new test before implementation and confirm its intended failure (event shape, batch TTL, or missing gate assertion).
- [ ] Mark `PauseToggled.paused` with `#[topic]` and update its rustdoc to `Topics: (pause_toggled, paused). Data: none (Void).`
- [ ] In successful `claim`, create `batch_key` before loading and call `bump_persistent(&env, &batch_key)` only after proof succeeds and claim state is written.
- [ ] In `revoke_leaf`, create `batch_key` and `revoked_key` once; use the same keys for lookup/set/TTL extension. Preserve auth and error order.

```rust
#[contractevent(data_format = "single-value")]
pub struct PauseToggled {
    #[topic]
    pub paused: bool,
}

// In claim, after every guard and after writing claim_key:
bump_persistent(&env, &claim_key);
bump_persistent(&env, &batch_key);
```
- [ ] Run `cargo fmt --manifest-path contracts/Cargo.toml`, `pnpm test:contract`, and `pnpm build:contract`.
- [ ] Commit: `feat(contract): retain claimed batches and index pause state`.

## Task 3: Canonical certificate envelope + truthful demo batch fixture

**Files:**
- Modify: `apps/probatum/package.json`
- Create: `apps/probatum/vitest.config.ts`
- Create: `apps/probatum/test/stubs/server-only.ts`
- Create: `apps/probatum/src/lib/bytes.ts`
- Create: `apps/probatum/src/lib/merkle.ts`
- Create: `apps/probatum/src/lib/certificate.ts`
- Create: `apps/probatum/src/lib/__tests__/merkle.test.ts`
- Create: `apps/probatum/src/lib/__tests__/certificate.test.ts`
- Create: `scripts/generate-demo-batch.mjs`
- Create: `fixtures/probatum-testnet-demo.json`
- Modify: `pnpm-lock.yaml`

- [ ] Add `test: "vitest run"`, `qrcode: "1.5.4"`, `candela-kit: "workspace:*"`, and `buffer: "6.0.3"`; add existing-pinned `vitest: "^2"`, `jsdom: "^25"`, and `@types/qrcode: "1.5.6"` to dev dependencies. Do not bump existing pins.
- [ ] Copy the proven `server-only` Vitest alias/stub pattern from `apps/candela` exactly.
- [ ] Write fail-first KAT tests for unsigned `compareBytes`, `hashPair`, and `verifyProof`; the four 0x65–0x68 leaves must reproduce the fixed KAT root.
- [ ] Write fail-first envelope tests: canonical key order is fixed; base64url encode/decode round-trips; changing `recipient`, `title`, or `salt` changes the leaf; invalid hex/base64 fails closed.
- [ ] Implement browser/Node-safe `Uint8Array` helpers and SHA-256 via `crypto.subtle`. `hashPair` compares numeric bytes (`0..255`) and hashes a 64-byte concatenation.

```ts
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return a.length - b.length;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export async function hashPair(a: Uint8Array, b: Uint8Array) {
  const [lo, hi] = compareBytes(a, b) <= 0 ? [a, b] : [b, a];
  const bytes = new Uint8Array(64);
  bytes.set(lo, 0);
  bytes.set(hi, 32);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}
```
- [ ] Define four explicitly testnet demo payloads with non-person identities and 128-bit salts. Generate their leaves, sorted-pair tree, proof arrays, root, and self-contained route IDs into `fixtures/probatum-testnet-demo.json`. The generator must be deterministic and refuse to overwrite if recomputation differs from the committed fixture.
- [ ] Run `pnpm --filter probatum-web test`; expected all pure tests green. Run the generator twice and byte-compare output.
- [ ] Commit: `feat(probatum-web): canonical certificate proofs and deterministic demo batch`.

## Task 4: Single v3 testnet deploy, KAT reseed, demo seed, and binding refresh

**Files:**
- Modify: `scripts/deploy-testnet.ps1`
- Modify: `deployments/testnet.json` (script output)
- Modify: `packages/candela-kit/playground/bindings.ts`
- Create: `apps/probatum/src/lib/probatum-bindings.ts`
- Modify: `.superpowers/sdd/progress.md` (local ledger only; never stage)

**Redeploy gate:** Tasks 1–3 suites and contract Wasm build must be green immediately before this task. This is the only v3 deployment command in the plan.

- [ ] Update deploy comments/smoke assertion to version 3 and fail unless the returned version is exactly `3`.
- [ ] Read the demo root/count from `fixtures/probatum-testnet-demo.json`; never duplicate them as literals in the script.
- [ ] Seed batch #1 first with the unchanged KAT root/count 4 and capture `genesisTx`.
- [ ] Seed batch #2 with the fixture root/count and capture `demoTx`; verify `batch_count == 2`, `claim_count == 0`, and both `get_batch` roots before writing deployment JSON.
- [ ] Extend deployment JSON with `genesisBatchId`, `demoBatchId`, `demoTx`, and `demoRoot`, while retaining `network`, `contractId`, `wasmHash`, `adminPublic`, `deployedAt`, and `genesisTx`. Write BOM-less UTF-8.
- [ ] Run exactly once:

```powershell
.\scripts\deploy-testnet.ps1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

- [ ] Independently invoke `version`, `batch_count`, `get_batch 1`, `get_batch 2`, and `claim_count`; verify both recorded transactions on Stellar/Horizon without printing any secret.
- [ ] Regenerate v3 TypeScript bindings from the deployed contract. Preserve the minimal-SDK import rule where required and delete the generated `networks` block so neither consumer embeds the contract ID. Consumers instantiate with `deployments/testnet.json`.
- [ ] Run contract tests/build, kit tests/build, and TypeScript checks for both binding consumers.
- [ ] Commit only public deployment/binding artifacts: `feat(testnet): deploy contract v3 and seed verifiable demo proof`.

## Task 5: Candela typed signing boundary, real phases, and identity assertions

**Files:**
- Modify: `packages/candela-kit/src/core/wallet.ts`
- Modify: `packages/candela-kit/src/react/useSubmit.ts`
- Modify: `packages/candela-kit/src/index.ts`
- Modify: `packages/candela-kit/tests/unit/wallet-state.test.ts`
- Create: `packages/candela-kit/tests/unit/use-submit.test.tsx`

- [ ] Replace `assembled: any` with `BuiltAssembledTransaction<T>` (`AssembledTransaction<T> & { built: Transaction }`) using type-only imports from the pinned SDK/base packages.
- [ ] Add a compile-time fixture in tests proving generated `Client.claim(...)` output can be narrowed only after `built` exists; throw `assembled transaction is missing built transaction` at runtime otherwise.
- [ ] Add fail-first hydration test: mocked `connectWallet({keyId})` returns a different contract ID; `signAndSubmit` must reject before `kit.sign`.
- [ ] Add fail-first phase test with a deferred mocked sign promise: UI state is `signing` while WebAuthn is pending, changes to `submitting` only when `onSigned` fires, then becomes `confirmed`.
- [ ] Assert both the hydrate return value and `kit.wallet.options.contractId` equal the persisted wallet contract ID.
- [ ] Move `setState({phase: "submitting"})` out of the pre-call path; pass `onSigned` to `signAndSubmit` and invoke it immediately after `kit.sign` resolves, before enforcing re-simulation/submission.
- [ ] Run `pnpm --filter candela-kit test`, `typecheck`, and `build`.
- [ ] Commit: `fix(candela-kit): type assembled calls and expose real signing phase`.

## Task 6: Candela same-origin submission transport + reload persistence

**Files:**
- Modify: `packages/candela-kit/src/core/config.ts`
- Modify: `packages/candela-kit/src/core/wallet.ts`
- Modify: `packages/candela-kit/src/react/context.tsx`
- Modify: `packages/candela-kit/src/react/useWallet.ts`
- Modify: `packages/candela-kit/tests/unit/config.test.ts`
- Modify: `packages/candela-kit/tests/unit/wallet-state.test.ts`
- Create: `packages/candela-kit/tests/unit/provider-storage.test.tsx`

- [ ] Add fail-first transport tests asserting `submissionUrl` receives `{ transaction: <xdr> }`, propagates non-2xx/error-shaped responses, and is preferred over the browser-only `sponsorSecret` fallback.
- [ ] Add fail-first provider persistence test: wallet is restored from a versioned localStorage record after mount, malformed/wrong-network records are discarded, `setWallet` persists, and disconnect removes it.
- [ ] Add `submissionUrl` to `CandelaConfig`; add `submissionUrl?` and `storageKey?` props to `CandelaProvider` while keeping the app-facing `network="testnet"` string preset. Memoize config/context values using primitive prop identities.
- [ ] Add `isHydrated` to `useWallet`. Do not render claim actions as disconnected until hydration completes.
- [ ] Route wallet deployment and prepared contract calls through a small `postTransaction` helper when `submissionUrl` is set. Retain the existing local secret fallback for the gitignored playground and retain Launchtube best-effort behavior; do not expose a secret in provider props.

```ts
async function postTransaction(url: string, transaction: Transaction) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: transaction.toXDR() }),
  });
  const result = await response.json();
  if (!response.ok || result?.status !== "SUCCESS") {
    throw new Error(result?.error ?? "sponsored submission failed");
  }
  return result as { hash: string; status: "SUCCESS" };
}
```
- [ ] Run the full kit test/typecheck/build suite and update the playground only if the public type change requires it.
- [ ] Commit: `feat(candela-kit): secure submission transport and wallet restoration`.

## Task 7: Server-only sponsor endpoint with operation allowlist

**Files:**
- Create: `apps/probatum/.env.example`
- Create: `apps/probatum/src/lib/sponsor.ts`
- Create: `apps/probatum/src/lib/__tests__/sponsor.test.ts`
- Create: `apps/probatum/src/app/api/candela/submit/route.ts`

- [ ] `.env.example` documents `PROBATUM_SPONSOR_SECRET=` with no value and states it must match `deployment.adminPublic`.
- [ ] Write fail-first pure validation tests for: malformed XDR, wrong network/source, multiple operations, excessive fee, arbitrary contract/function, wrong wallet Wasm hash, and the two allowed shapes.
- [ ] Allowed shape A: passkey-kit wallet deployment only—single create-contract operation using the pinned wallet Wasm hash; submit as a sponsor-signed fee bump.
- [ ] Allowed shape B: single invoke-contract operation to `deployment.contractId`, function `claim`, with the transaction source equal to `deployment.adminPublic`; sign the prepared inner transaction with the server sponsor.
- [ ] At request time derive the secret’s public key and compare it to `deployment.adminPublic`; fail closed on mismatch. Parse/sign with `@stellar/stellar-base`, never `/minimal`, and poll RPC to final SUCCESS.
- [ ] Enforce same-origin POST semantics, JSON/body size bounds, a conservative fee ceiling, no secret-bearing logs, and error responses that do not echo transaction internals.
- [ ] Run Probatum unit tests and a route-level local request using only inert/mocked keys.
- [ ] Commit: `feat(probatum-web): server-only sponsor transport for wallet and claim`.

## Task 8: Live-chain verification resolver

**Files:**
- Create: `apps/probatum/src/lib/verification.ts`
- Create: `apps/probatum/src/lib/__tests__/verification.test.ts`
- Modify: `apps/probatum/src/lib/chain.ts`

- [ ] Extract reusable deployment/RPC constants without changing the existing soft-fallback landing stats API.
- [ ] Write fail-first resolver tests covering VALID, batch REVOKED, leaf REVOKED, TAMPERED payload, TAMPERED proof/root, missing batch, claimed/unclaimed, and RPC unavailable. RPC unavailable is a neutral operational error—not falsely labelled tampered.
- [ ] Decode the self-contained route envelope; canonicalize/hash payload; compute proof root; then read `get_batch`, `is_batch_revoked`, `is_leaf_revoked`, `claim_of`, and issuer profile through the regenerated binding.
- [ ] After `get_batch` succeeds, run independent revocation/claim/profile reads in parallel. Record warm-route timing and keep the normal testnet verification target at approximately one second; never trade correctness for a false fast verdict during RPC degradation.
- [ ] State precedence: structural/decode/proof mismatch → TAMPERED; matching proof plus either revocation flag → REVOKED; matching proof and no revocation → VALID. Claim address is supplemental and never changes validity.

```ts
const leaf = await hashCertificate(envelope.payload);
const computedRoot = await foldProof(leaf, envelope.proof.map(hexToBytes));
const batch = await chain.getBatch(envelope.batchId);
const state: VerificationState = !batch || !equalBytes(computedRoot, batch.root)
  ? "TAMPERED"
  : batch.revoked || await chain.isLeafRevoked(envelope.batchId, leaf)
    ? "REVOKED"
    : "VALID";
```
- [ ] Wrap the server resolver with React `cache()` so page metadata/body/OG work can reuse one request-local result. Do not soft-fallback a verifier to VALID.
- [ ] Run `pnpm --filter probatum-web test` and a live read of the new demo envelope against batch #2.
- [ ] Commit: `feat(probatum-web): resolve certificate proofs against live Stellar state`.

## Task 9: Verification route composition

**Files:**
- Create: `apps/probatum/src/app/verify/[id]/page.tsx`
- Create: `apps/probatum/src/app/verify/[id]/VerificationView.tsx`
- Create: `apps/probatum/src/components/VerificationShell.tsx`
- Modify: `apps/probatum/src/app/globals.css`

- [ ] Build an async server route with fresh chain state (`revalidate = 0` or `noStore`) and a neutral unavailable view.
- [ ] Compose one dominant certificate artifact with a right-side proof rail: verdict, canonical certificate fields, issuer address, batch/root/leaf, anchor timestamp, revocation/claim state, explorer links. No dashboard card mosaic and no invented stats.
- [ ] Reuse the `VerifyStack` badge language but make VALID silver/white, while REVOKED/TAMPERED use only functional wax red. Copy says “payload/proof matches this issuer’s on-chain batch,” never “issuer is legitimate.”
- [ ] Add entrance/scan/seal transitions in a thin client shell; CSS reduced-motion renders the complete final verdict immediately.
- [ ] Verify server render for valid, revoked fixture/mocked state, tampered ID, RPC unavailable, 375px width, keyboard focus, and screen-reader verdict announcement. Presentational checks are render/browser checks, not fabricated unit tests.
- [ ] Commit: `feat(probatum-web): public valid revoked and tampered verification route`.

## Task 10: Passkey claim surface built on Candela

**Files:**
- Create: `apps/probatum/src/app/verify/[id]/ClaimPanel.tsx`
- Create: `apps/probatum/src/components/CandelaClaimProvider.tsx`
- Modify: `apps/probatum/src/app/verify/[id]/page.tsx`
- Modify: `apps/probatum/next.config.ts`
- Create: `docs/security/claim-links.md`

- [ ] Add `transpilePackages: ["candela-kit"]` to the consuming Next config.
- [ ] Wrap only the interactive claim region with `<CandelaProvider network="testnet" submissionUrl="/api/candela/submit" storageKey="probatum:testnet:wallet">`—the network prop remains the string preset.
- [ ] Use the real exported `SignUpButton`, `SignInButton`, `useWallet`, and `useSubmit`. Instantiate the regenerated Probatum client with contract ID/admin public key from deployment JSON and build `claim({recipient: wallet.contractId, batch_id, leaf_hash, proof})` from the decoded envelope.

```ts
const claimTx = await probatum.claim({
  recipient: wallet.contractId,
  batch_id: BigInt(envelope.batchId),
  leaf_hash: Buffer.from(leaf),
  proof: envelope.proof.map((sibling) => Buffer.from(sibling, "hex")),
});
if (!claimTx.built) throw new Error("claim transaction was not assembled");
await submit(claimTx as BuiltAssembledTransaction);
```
- [ ] Show explicit phases: “Touch your passkey” (`signing`), “Submitting—fees sponsored” (`submitting`), transaction-linked confirmation, and actionable failure. After confirmation refresh the server route so `claim_of` is authoritative.
- [ ] Hide/disable claim on TAMPERED/REVOKED, show existing claimant without implying a tradeable token, and explain that claim binds proof to a wallet—it mints nothing.
- [ ] Document the current first-claimant threat: real claim URLs require confidential, unguessable delivery; the public testnet demo is intentionally open; recipient binding/domain separation remain pre-mainnet decisions.
- [ ] Render-test signup/signin/hydration/claimed/failed states and run unit tests + build.
- [ ] Commit: `feat(probatum-web): claim certificates with Candela passkeys`.

## Task 11: QR, LinkedIn share, dynamic Open Graph, and landing-loop wiring

**Files:**
- Create: `apps/probatum/src/app/verify/[id]/opengraph-image.tsx`
- Create: `apps/probatum/src/components/ShareActions.tsx`
- Modify: `apps/probatum/src/app/verify/[id]/page.tsx`
- Modify: `apps/probatum/src/components/clone/VerifyStack.tsx`
- Modify: `apps/probatum/src/components/clone/NavPill.tsx`
- Modify: `apps/probatum/src/components/clone/HeroC.tsx`
- Modify: `apps/probatum/src/components/clone/CtaFinale.tsx`

- [ ] Generate a real QR data URL server-side with `qrcode` for the canonical verify URL; include a quiet zone and sufficient contrast. The URL origin comes from a public site-origin helper/env default, not a component literal.
- [ ] Add LinkedIn share-offsite URL with the canonical verify URL encoded. The dynamic OG image decodes/resolves the same certificate and visibly reflects VALID/REVOKED/TAMPERED plus “Stellar testnet”; do not include a fake tx/wallet.
- [ ] Wire the landing page’s Verify CTA/nav and existing QR visual to the real seeded demo route. Change issue-only CTAs that point nowhere into honest “Verify the live demo” / source actions; the CSV issue pipeline remains out of scope.
- [ ] Add the loop closer: “Running an event? Issue with Probatum—coming next” without claiming the issuer flow exists today.
- [ ] Verify LinkedIn URL, QR decode target, metadata tags, OG image response, reduced motion, and mobile layout in a browser.
- [ ] Commit: `feat(probatum-web): complete QR and LinkedIn proof-sharing loop`.

## Task 12: Live testnet lifecycle proof

**Files:**
- Modify: `packages/candela-kit/tests/e2e/kit.spec.ts`
- Modify: `packages/candela-kit/playground/main.tsx`
- Create: `apps/probatum/playwright.config.ts`
- Create: `apps/probatum/tests/e2e/viral-loop.spec.ts`
- Modify: `apps/probatum/package.json`
- Modify: `.superpowers/sdd/progress.md` (local-only evidence)

- [ ] Update kit playground bindings/deployment defaults to v3 and add lifecycle controls that use only the kit’s public React API.
- [ ] Extend the repeatable kit E2E: create a new passkey wallet → persist → reload → restore wallet → submit `register_issuer` → clear only app storage → `SignInButton` with the resident passkey → `update_issuer`. Assert the same wallet ID after sign-in and both live transactions. This proves interactive sign-in and post-reload `connectWallet({keyId})` hydration without consuming fixed certificate leaves.
- [ ] Add Probatum E2E: open the live demo envelope, assert VALID from chain, create/restore a wallet, claim an available seeded demo leaf through `SignUpButton/useSubmit`, wait for confirmed tx, reload, and assert `claim_of` plus share/QR UI. The test selects an unclaimed fixture slot; if all committed slots are consumed, fail with an explicit “fresh demo seed required” message rather than passing without a claim.
- [ ] Capture public wallet/tx hashes in the local ledger/acceptance report only. Never capture the sponsor secret.
- [ ] Independently invoke `claim_of` for the claimed leaf and verify the transaction on Stellar.
- [ ] Commit repeatable test code only: `test(e2e): prove Candela hydration and Probatum claim on testnet`.

## Task 13: Integrated verification and release review

**Files:**
- Modify only files required by defects found during verification.
- Update: `.superpowers/sdd/progress.md` (local-only)

- [ ] Confirm no process owns port 3000; then run:

```powershell
pnpm test:contract
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm build:contract
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm --filter candela-kit test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm --filter candela-kit typecheck
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm --filter candela-kit build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm --filter probatum-web test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm --filter probatum-web build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

- [ ] Browser matrix: valid/revoked/tampered/unavailable, claim phases, signup/signin, reload restore, claimed state, LinkedIn/QR/OG, keyboard, 375px mobile, reduced motion, zero console errors.
- [ ] Measure the warm valid route from request start to rendered verdict against live testnet RPC; target ~1 second and record the actual evidence in the local ledger.
- [ ] On-chain audit: version 3; contract ID/wasm hash match deployment file; batch #1 KAT root unchanged; batch #2 demo root matches committed fixture; successful claim and counters; no accidental second v3 deployment.
- [ ] Secret scan staged diff and git history for the task range. Confirm no contract ID literal outside deployment/generated evidence comments and no `.env*` staged.
- [ ] Review copy for regulatory and credential-laundering claims; review all real artifacts against deployment/testnet evidence.
- [ ] If fixes were needed, commit them with scoped conventional messages; otherwise record a clean verification pass without fabricating a commit.

## Acceptance criteria

- Contract `version() == 3`; all old tests plus new TTL/claim-bump/event/pause tests pass; Wasm builds.
- Instance/code TTL is extended by committed write paths and `bump_batch`; successful claim extends its parent batch.
- Exactly one new coordinated v3 contract is deployed; deployment JSON is updated; batch #1 retains the KAT root; batch #2 is a truthful canonical demo batch.
- `/verify/[id]` independently recomputes the self-contained certificate leaf/proof and resolves live VALID/REVOKED/TAMPERED state without login.
- Claim uses `CandelaProvider network="testnet"`, `SignUpButton`/`SignInButton`, and `useSubmit`; the sponsor secret never reaches the browser; a real testnet claim is confirmed on-chain.
- Interactive sign-in and reload hydration are live-proven with the same wallet identity and a post-hydration contract-ID assertion.
- LinkedIn share and QR target the canonical verify route; dynamic OG reflects the live verdict.
- UI remains monochrome/premium, responsive, accessible, and complete under reduced motion.
- No npm publish, no mainnet deploy, no issuer CSV/anchor UI, no secret commit, and no India regulatory red line.

## Explicitly deferred

- Generic issuer CSV → canonicalize → merkle → anchor pipeline.
- Mainnet deployment and production sponsor/rate-limit infrastructure.
- Strong recipient binding beyond confidential unguessable claim links.
- Merkle domain separation/depth-bound contract change and upgradeability decision.
- npm name check, README/sourcemap decision, and gated `candela-kit` publish.
