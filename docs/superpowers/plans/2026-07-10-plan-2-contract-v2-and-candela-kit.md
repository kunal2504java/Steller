# Plan 2: Contract v2 & Candela Kit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Probatum contract (constructor, pause event, TTL strategy, typed claim counter), redeploy to testnet, and extract the spike's proven passkey+sponsor code into the real `candela-kit` React package with an end-to-end Playwright regression.

**Architecture:** Contract changes land as one batch → one redeploy (new contract id) → consumers repoint via `deployments/testnet.json`. The kit is a new workspace package: framework-free core (`src/core/*` wraps passkey-kit + submission paths exactly as proven in the spike) plus a thin React layer (`src/react/*`). The spike stays frozen as reference; the kit gets its own playground page driven by the ported virtual-authenticator test.

**Tech Stack:** Rust + soroban-sdk 23.5.3, stellar CLI 27, passkey-kit 0.11.3 (exact pin), @stellar/stellar-sdk 14.6.1, @stellar/stellar-base 14.1.0, React 19 (peer), Vite playground, Playwright + CDP virtual authenticator, vitest.

**Plan roadmap (2 of 4):** Plan 3 = Probatum app (issue/cert/verify/claim flows on the kit). Plan 4 = docs site, mainnet, launch. Spec: `docs/superpowers/specs/2026-07-03-candela-probatum-design.md` (§4 kit API, §6 contract). Ledger: `.superpowers/sdd/progress.md` (final-review batch).

## Global Constraints

- **Exact dependency pins (Node is 22.17.0; passkey-kit 0.12+ needs ≥22.18):** `passkey-kit@0.11.3`, `@stellar/stellar-sdk@14.6.1`, `@stellar/stellar-base@14.1.0`, `buffer@6.0.3`.
- **The two spike traps are law:** (1) import `Keypair`/`TransactionBuilder` from `@stellar/stellar-base`, NEVER `@stellar/stellar-sdk/minimal` (dual-XDR `XDR Write Error`); (2) after `kit.sign(...)` always re-simulate + `assembleTransaction` before fallback submission (secp256r1 `__check_auth` isn't priced by the recording sim).
- **No secrets in committed files.** Sponsor secret lives in gitignored `.env` only.
- **Error enum discriminants are append-only** (existing #1–#10 keep their numbers; new variants start at 11). Merkle scheme unchanged (sorted-pair sha256, KAT test must stay green).
- **Contract test evidence:** fail-first output captured in the task report, then full suite green (`pnpm test:contract`).
- Windows/PS 5.1: `stellar` CLI needs the PATH refresh (docs/DEV.md); native-exe failures need `$LASTEXITCODE` checks; never run `next build` while the web dev server runs.
- Wallet wasm hash proven on testnet: `ecd990f0b45ca6817149b6175f79b32efb442f35731985a084131e8265c4cd90`.

## File Structure (this plan)

```
contracts/probatum/src/lib.rs        # modify: __constructor, pause v2, ClaimCount, TTL
contracts/probatum/src/test.rs       # modify: setup(), new tests
scripts/deploy-testnet.ps1           # modify: constructor-arg deploy, genesisTx capture
deployments/testnet.json             # regenerated (new contractId + genesisTx)
apps/probatum/src/lib/chain.ts       # modify: read deployment JSON, no hardcoded id
apps/probatum/src/components/clone/HeroC.tsx  # modify: genesis tx string via stats
packages/candela-kit/package.json    # new package (name: candela-kit)
packages/candela-kit/tsconfig.json
packages/candela-kit/src/core/config.ts      # network presets + CandelaConfig
packages/candela-kit/src/core/passkeys.ts    # canUsePasskeys()
packages/candela-kit/src/core/wallet.ts      # createWallet/connect/sign/submit paths
packages/candela-kit/src/react/context.tsx   # CandelaProvider + useCandela
packages/candela-kit/src/react/useWallet.ts
packages/candela-kit/src/react/useSubmit.ts
packages/candela-kit/src/react/buttons.tsx   # SignUpButton / SignInButton
packages/candela-kit/src/index.ts
packages/candela-kit/tests/unit/*.test.ts    # vitest
packages/candela-kit/playground/*            # vite page for e2e
packages/candela-kit/tests/e2e/kit.spec.ts   # ported virtual-authenticator regression
```

---

### Task 1: Contract — `__constructor` migration (kills init front-running)

**Files:**
- Modify: `contracts/probatum/src/lib.rs` (replace `init`)
- Modify: `contracts/probatum/src/test.rs` (setup + tests)

**Interfaces:**
- Consumes: existing `ProbatumContract` (16 fns, `init(admin)` two-tx pattern).
- Produces: `__constructor(env, admin: Address)` — runs atomically at deploy; `version() -> 2`; `init` REMOVED. Test setup idiom all later tasks use: `env.register(ProbatumContract, (admin.clone(),))`.

- [ ] **Step 1: Rewrite test setup + constructor tests (failing first)**

In `contracts/probatum/src/test.rs`, replace the existing `setup()` and delete `test_double_init_panics`:

```rust
fn setup() -> (Env, ProbatumContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(ProbatumContract, (admin.clone(),));
    let client = ProbatumContractClient::new(&env, &id);
    (env, client, admin)
}

#[test]
fn test_constructor_initializes_state() {
    let (_env, client, _admin) = setup();
    assert_eq!(client.version(), 2);
    assert_eq!(client.is_paused(), false);
    assert_eq!(client.batch_count(), 0);
    assert_eq!(client.claim_count(), 0);
}
```

Also update `test_init_and_pause`: rename to `test_pause_toggle`, drop any `client.init(...)` call (setup already constructed), keep the pause assertions.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:contract`
Expected: FAIL — `env.register` with constructor args doesn't match a contract without `__constructor` (and/or `init` still exists while no test calls it → compile error for the removed test references).

- [ ] **Step 3: Implement in lib.rs**

Remove `pub fn init(...)` entirely. Add in its place:

```rust
    /// Runs atomically at deploy time — no init front-running window.
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::BatchSeq, &0u64);
    }
```

Change `version()` to return `2`. Keep `Error::AlreadyInitialized = 1` in the enum with a comment `// reserved (v1 init) — discriminants are append-only`.

- [ ] **Step 4: Run tests to verify all pass**

Run: `pnpm test:contract`
Expected: all tests pass (same count as before minus `test_double_init_panics`, plus `test_constructor_initializes_state`). Capture output.

- [ ] **Step 5: Commit**

```powershell
git add contracts/probatum/src/
git commit -m "feat(contract)!: atomic __constructor replaces init; version 2"
```

---

### Task 2: Contract — pause event + Result-returning pause

**Files:**
- Modify: `contracts/probatum/src/lib.rs`, `contracts/probatum/src/test.rs`

**Interfaces:**
- Consumes: Task 1 state (constructor guarantees Admin exists).
- Produces: `pause(paused: bool) -> Result<(), Error>`; event struct `PauseToggled { paused: bool }`; `Error::NotInitialized = 11` (appended).

- [ ] **Step 1: Write failing test** (append to test.rs)

```rust
#[test]
fn test_pause_emits_event() {
    let (env, client, _admin) = setup();
    client.pause(&true);
    let events = env.events().all();
    assert!(!events.is_empty(), "pause must emit an event");
    assert_eq!(client.is_paused(), true);
}
```

- [ ] **Step 2: Run to verify current state**

Run: `pnpm test:contract`
Expected: `test_pause_emits_event` FAILS (no event emitted by v1 pause).

- [ ] **Step 3: Implement**

Append to the `Error` enum: `NotInitialized = 11,`. Next to the other five `#[contractevent]` structs, add one matching their exact attribute style (copy the pattern used by `BatchRevoked` in this file):

```rust
#[contractevent(data_format = "single-value")]
pub struct PauseToggled {
    pub paused: bool,
}
```

Replace `pause`:

```rust
    pub fn pause(env: Env, paused: bool) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
        PauseToggled { paused }.publish(&env);
        Ok(())
    }
```

(If the existing events in this file use a different emit call than `.publish(&env)`, mirror the existing style exactly — they are the source of truth.)

- [ ] **Step 4: Run tests** — Expected: all pass, including every pre-existing pause test.

- [ ] **Step 5: Commit**

```powershell
git add contracts/probatum/src/
git commit -m "feat(contract): PauseToggled event, Result-returning pause"
```

---

### Task 3: Contract — typed claim counter + TTL strategy

**Files:**
- Modify: `contracts/probatum/src/lib.rs`, `contracts/probatum/src/test.rs`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `DataKey::ClaimCount` (replaces raw `symbol_short!("claims")` storage); TTL constants `TTL_THRESHOLD: u32 = 1_500_000`, `TTL_EXTEND_TO: u32 = 3_000_000`; every persistent write extends its own TTL; public `bump_batch(batch_id: u64) -> Result<(), Error>` (anyone can call — the answer to "who keeps entries alive").

- [ ] **Step 1: Write failing tests** (append)

```rust
#[test]
fn test_bump_batch() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    let bid = client.anchor_batch(&issuer, &h(&env, 10), &h(&env, 11), &10u32);
    client.bump_batch(&bid); // must not panic; extends batch + issuer TTL
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")] // BatchNotFound
fn test_bump_missing_batch_panics() {
    let (_env, client, _admin) = setup();
    client.bump_batch(&99u64);
}
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL, `bump_batch` not found.

- [ ] **Step 3: Implement**

Add `ClaimCount,` to the `DataKey` enum (append — do not reorder existing variants). Add constants + helper above the impl:

```rust
/// ~6 months at 5s/ledger — refreshed on every touch, and by bump_batch.
const TTL_THRESHOLD: u32 = 1_500_000;
const TTL_EXTEND_TO: u32 = 3_000_000;

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}
```

After EVERY `env.storage().persistent().set(&key, ...)` in `register_issuer`, `update_issuer`, `anchor_batch`, `revoke_leaf`, and `claim`, add `bump_persistent(&env, &key);` (using that call site's key). In `claim`, replace both counter accesses: read `env.storage().instance().get(&DataKey::ClaimCount)`, write `env.storage().instance().set(&DataKey::ClaimCount, &(claims + 1))`. Update `claim_count()` to read `DataKey::ClaimCount`. Add:

```rust
    pub fn bump_batch(env: Env, batch_id: u64) -> Result<(), Error> {
        let batch: Batch = env
            .storage()
            .persistent()
            .get(&DataKey::Batch(batch_id))
            .ok_or(Error::BatchNotFound)?;
        bump_persistent(&env, &DataKey::Batch(batch_id));
        bump_persistent(&env, &DataKey::Issuer(batch.issuer));
        Ok(())
    }
```

- [ ] **Step 4: Run tests** — Expected: all pass (claim tests exercise the new counter path; KAT stays green).

- [ ] **Step 5: Wasm build + commit**

Run: `pnpm build:contract` — must succeed with zero warnings.

```powershell
git add contracts/probatum/src/
git commit -m "feat(contract): typed ClaimCount key, per-write TTL extension, public bump_batch"
```

---

### Task 4: Redeploy testnet (v2) + reseed + record genesisTx

**Files:**
- Modify: `scripts/deploy-testnet.ps1`
- Regenerate: `deployments/testnet.json` (committed)

**Interfaces:**
- Consumes: v2 wasm from Task 3; CLI identity `probatum-admin` (exists, funded).
- Produces: NEW testnet contract id; `deployments/testnet.json` with keys `network, contractId, wasmHash, adminPublic, deployedAt, genesisTx` — Task 5 and Task 7 consume `contractId`/`genesisTx`.

- [ ] **Step 1: Update the deploy script for constructor deployment**

In `scripts/deploy-testnet.ps1`: (a) change the deploy line to pass the constructor arg —

```powershell
$contractId = stellar contract deploy --wasm $wasm --source $who --network testnet -- --admin $admin
```

(b) DELETE the separate `contract invoke ... -- init --admin` step and its guard. (c) After the smoke tests, add the seeding block (idempotent for a FRESH contract — this script now always deploys new, which is documented behavior):

```powershell
# seed: issuer + genesis batch (KAT root — keeps the demo batch claimable)
$profile = python -c "import hashlib; print(hashlib.sha256(b'probatum.app').hexdigest())"
$meta = python -c "import hashlib; print(hashlib.sha256(b'probatum-demo-batch-genesis').hexdigest())"
stellar contract invoke --id $contractId --source $who --network testnet -- register_issuer --issuer $admin --profile_hash $profile
if ($LASTEXITCODE -ne 0) { throw "seed register_issuer failed" }
$anchorOut = stellar contract invoke --id $contractId --source $who --network testnet -- anchor_batch --issuer $admin --root 57c49ece895537b2bf5dfe5ba421bbf7666f12a00d28a81c29ba0faa52cd1902 --meta $meta --count 4 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw "seed anchor_batch failed" }
$genesisTx = ([regex]::Match($anchorOut, "tx/([0-9a-f]{64})")).Groups[1].Value
```

(d) include `genesisTx = "$genesisTx"` in the JSON object written (keep the BOM-less `[System.IO.File]::WriteAllText` writer).

- [ ] **Step 2: Run it**

Run: `powershell -File scripts/deploy-testnet.ps1`
Expected: new contract id printed; smoke `version` → `2`, then after seeding `batch_count` → `1`; `deployments/testnet.json` has all six keys, no BOM (`node -e "JSON.parse(require('fs').readFileSync('deployments/testnet.json','utf8')); console.log('parses clean')"`).

- [ ] **Step 3: Commit**

```powershell
git add scripts/deploy-testnet.ps1 deployments/testnet.json
git commit -m "feat: v2 testnet deployment — constructor deploy, seeded genesis, genesisTx recorded"
```

---

### Task 5: Repoint consumers at the deployment file

**Files:**
- Modify: `apps/probatum/src/lib/chain.ts`
- Modify: `apps/probatum/src/components/clone/HeroC.tsx` (tx string + link)

**Interfaces:**
- Consumes: `deployments/testnet.json` (`contractId`, `network`, `genesisTx`).
- Produces: `ChainStats` gains `genesisTx: string`; no hardcoded contract id anywhere in the app.

- [ ] **Step 1: chain.ts reads the deployment**

Replace the hardcoded constants block in `apps/probatum/src/lib/chain.ts`:

```ts
import deployment from "../../../../deployments/testnet.json";

const CONTRACT_ID = deployment.contractId;
const NETWORK = deployment.network;
const GENESIS_TX = deployment.genesisTx;
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
```

Add `genesisTx: string` to the `ChainStats` type; include `genesisTx: GENESIS_TX` in both `FALLBACK` and the success return; `network: NETWORK` likewise; contractUrl built from `CONTRACT_ID`.

- [ ] **Step 2: HeroC uses the real tx**

In the "Batch #1" card of `apps/probatum/src/components/clone/HeroC.tsx`, replace the hardcoded `tx 4c69c26d…78d6` line with a truncation of the live value:

```tsx
<p className="mt-3 break-all font-mono text-[10px] leading-relaxed text-ash">
  root 57c49ece…1902
  <br />
  tx {stats.genesisTx.slice(0, 8)}…{stats.genesisTx.slice(-4)}
</p>
```

- [ ] **Step 3: Verify**

Run: `pnpm --filter probatum-web build` (web dev server must NOT be running)
Expected: build succeeds; static page prerenders with the new contract id (grep `.next/server/app/index.html` for the new id is optional confirmation).

- [ ] **Step 4: Commit**

```powershell
git add apps/probatum/
git commit -m "feat(web): landing reads deployments/testnet.json — no hardcoded contract id"
```

---

### Task 6: candela-kit package — core + React API + unit tests

**Files:**
- Create: `packages/candela-kit/package.json`, `tsconfig.json`, `src/core/config.ts`, `src/core/passkeys.ts`, `src/core/wallet.ts`, `src/react/context.tsx`, `src/react/useWallet.ts`, `src/react/useSubmit.ts`, `src/react/buttons.tsx`, `src/index.ts`, `tests/unit/config.test.ts`, `tests/unit/passkeys.test.ts`, `vitest.config.ts`

**Interfaces:**
- Consumes: the spike's proven sequences (reference: `packages/spike/src/main.ts` and `.superpowers/sdd/task-10-report.md` §"What Candela should wrap") — copy the WORKING logic, restructured; do not import from the spike.
- Produces (public API, consumed by Task 7 and Plan 3):
  - `type CandelaConfig = { rpcUrl: string; networkPassphrase: string; walletWasmHash: string; launchtube?: { url: string; jwt: string }; sponsorSecret?: string }`
  - `resolveConfig(network: "testnet" | CandelaConfig): CandelaConfig`
  - `canUsePasskeys(): boolean`
  - `createWallet(cfg, appName, userName): Promise<{ contractId: string; keyIdBase64: string }>` (deploys via Launchtube when configured, else fee-bump fallback; throws on non-SUCCESS)
  - `connectWallet(cfg): Promise<{ contractId: string; keyIdBase64: string }>`
  - `signAndSubmit(cfg, wallet, assembledTx): Promise<{ hash: string; status: string }>` (kit.sign → re-simulate → assemble → sponsor-sign → send → poll)
  - React: `<CandelaProvider config>`, `useWallet() -> { wallet, isConnected, disconnect }`, `useSubmit() -> { submit, state }`, `<SignUpButton onWallet appName userName>`, `<SignInButton onWallet>`

- [ ] **Step 1: Package scaffold**

`packages/candela-kit/package.json`:

```json
{
  "name": "candela-kit",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@stellar/stellar-base": "14.1.0",
    "@stellar/stellar-sdk": "14.6.1",
    "buffer": "6.0.3",
    "passkey-kit": "0.11.3"
  },
  "peerDependencies": {
    "react": ">=19"
  },
  "devDependencies": {
    "@playwright/test": "^1.61",
    "@types/react": "^19",
    "@vitejs/plugin-react": "^4",
    "jsdom": "^25",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "typescript": "^5.9.3",
    "vite": "^6",
    "vitest": "^2"
  }
}
```

`tsconfig.json`: copy `packages/spike/tsconfig.json` and add `"jsx": "react-jsx"`. `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "jsdom", include: ["tests/unit/**/*.test.ts"] },
});
```

Run `pnpm install` at repo root after creating files.

- [ ] **Step 2: Failing unit tests first**

`tests/unit/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveConfig } from "../../src/core/config";

describe("resolveConfig", () => {
  it("resolves the testnet preset", () => {
    const c = resolveConfig("testnet");
    expect(c.rpcUrl).toBe("https://soroban-testnet.stellar.org");
    expect(c.networkPassphrase).toBe("Test SDF Network ; September 2015");
    expect(c.walletWasmHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("passes through a custom config verbatim", () => {
    const custom = {
      rpcUrl: "http://x",
      networkPassphrase: "p",
      walletWasmHash: "a".repeat(64),
    };
    expect(resolveConfig(custom)).toEqual(custom);
  });
});
```

`tests/unit/passkeys.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canUsePasskeys } from "../../src/core/passkeys";

describe("canUsePasskeys", () => {
  it("is false when PublicKeyCredential is absent (jsdom default)", () => {
    expect(canUsePasskeys()).toBe(false);
  });
  it("is true when the API is present", () => {
    (globalThis as any).window.PublicKeyCredential = class {};
    expect(canUsePasskeys()).toBe(true);
    delete (globalThis as any).window.PublicKeyCredential;
  });
});
```

Run: `pnpm --filter candela-kit test` — Expected: FAIL (modules don't exist).

- [ ] **Step 3: Implement core**

`src/core/config.ts`:

```ts
export type CandelaConfig = {
  rpcUrl: string;
  networkPassphrase: string;
  walletWasmHash: string;
  launchtube?: { url: string; jwt: string };
  /** Fallback sponsor (testnet/dev). NEVER commit a real secret. */
  sponsorSecret?: string;
};

const TESTNET: CandelaConfig = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  walletWasmHash:
    "ecd990f0b45ca6817149b6175f79b32efb442f35731985a084131e8265c4cd90",
};

export function resolveConfig(
  network: "testnet" | CandelaConfig,
): CandelaConfig {
  return network === "testnet" ? { ...TESTNET } : network;
}
```

`src/core/passkeys.ts`:

```ts
/** WebAuthn platform-credential support — the gate for every kit flow. */
export function canUsePasskeys(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}
```

`src/core/wallet.ts` — extract from `packages/spike/src/main.ts`, keeping its logic byte-for-byte where marked. Complete file:

```ts
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

function kitFor(cfg: CandelaConfig): PasskeyKit {
  return new PasskeyKit({
    rpcUrl: cfg.rpcUrl,
    networkPassphrase: cfg.networkPassphrase,
    walletWasmHash: cfg.walletWasmHash,
  });
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
    return server.send(signedTx);
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
```

NOTE for the implementer: if the spike's working `main.ts` differs from the above in any call detail (e.g. the sponsor-as-source client construction), THE SPIKE IS RIGHT — mirror it and record the deviation in your report.

- [ ] **Step 4: Implement the React layer**

`src/react/context.tsx`:

```tsx
"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { resolveConfig, type CandelaConfig } from "../core/config";
import type { CandelaWallet } from "../core/wallet";

type Ctx = {
  config: CandelaConfig;
  wallet: CandelaWallet | null;
  setWallet: (w: CandelaWallet | null) => void;
};

const CandelaContext = createContext<Ctx | null>(null);

export function CandelaProvider({
  network,
  children,
}: {
  network: "testnet" | CandelaConfig;
  children: ReactNode;
}) {
  const config = useMemo(() => resolveConfig(network), [network]);
  const [wallet, setWallet] = useState<CandelaWallet | null>(null);
  return (
    <CandelaContext.Provider value={{ config, wallet, setWallet }}>
      {children}
    </CandelaContext.Provider>
  );
}

export function useCandela(): Ctx {
  const ctx = useContext(CandelaContext);
  if (!ctx) throw new Error("useCandela requires <CandelaProvider>");
  return ctx;
}
```

`src/react/useWallet.ts`:

```ts
"use client";
import { useCandela } from "./context";

export function useWallet() {
  const { wallet, setWallet } = useCandela();
  return {
    wallet,
    isConnected: wallet !== null,
    disconnect: () => setWallet(null),
  };
}
```

`src/react/useSubmit.ts`:

```ts
"use client";
import { useState } from "react";
import { useCandela } from "./context";
import { signAndSubmit } from "../core/wallet";

export type SubmitState =
  | { phase: "idle" }
  | { phase: "signing" }
  | { phase: "submitting" }
  | { phase: "confirmed"; hash: string }
  | { phase: "failed"; error: string };

export function useSubmit() {
  const { config, wallet } = useCandela();
  const [state, setState] = useState<SubmitState>({ phase: "idle" });

  async function submit(assembled: any) {
    if (!wallet) throw new Error("no wallet connected");
    setState({ phase: "signing" });
    try {
      setState({ phase: "submitting" });
      const res = await signAndSubmit(config, wallet, assembled);
      setState({ phase: "confirmed", hash: res.hash });
      return res;
    } catch (e) {
      setState({ phase: "failed", error: String(e) });
      throw e;
    }
  }

  return { submit, state };
}
```

`src/react/buttons.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useCandela } from "./context";
import { canUsePasskeys } from "../core/passkeys";
import { createWallet, connectWallet, type CandelaWallet } from "../core/wallet";

type ButtonProps = {
  onWallet?: (w: CandelaWallet) => void;
  appName?: string;
  userName?: string;
  className?: string;
  children?: React.ReactNode;
};

function useFlow(
  onWallet: ButtonProps["onWallet"],
  run: () => Promise<CandelaWallet>,
) {
  const { setWallet } = useCandela();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    if (!canUsePasskeys()) {
      setError("Passkeys are not supported in this browser — open in Chrome or Safari.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const w = await run();
      setWallet(w);
      onWallet?.(w);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return { go, busy, error };
}

export function SignUpButton({
  onWallet,
  appName = "Candela",
  userName = "user",
  className,
  children,
}: ButtonProps) {
  const { config } = useCandela();
  const { go, busy, error } = useFlow(onWallet, () =>
    createWallet(config, appName, userName),
  );
  return (
    <span data-candela="signup">
      <button type="button" className={className} disabled={busy} onClick={go}>
        {busy ? "Creating wallet…" : (children ?? "Sign up with passkey")}
      </button>
      {error && <span role="alert" data-candela="error">{error}</span>}
    </span>
  );
}

export function SignInButton({ onWallet, className, children }: ButtonProps) {
  const { config } = useCandela();
  const { go, busy, error } = useFlow(onWallet, () => connectWallet(config));
  return (
    <span data-candela="signin">
      <button type="button" className={className} disabled={busy} onClick={go}>
        {busy ? "Connecting…" : (children ?? "Sign in with passkey")}
      </button>
      {error && <span role="alert" data-candela="error">{error}</span>}
    </span>
  );
}
```

`src/index.ts`:

```ts
export { resolveConfig, type CandelaConfig } from "./core/config";
export { canUsePasskeys } from "./core/passkeys";
export {
  createWallet,
  connectWallet,
  signAndSubmit,
  type CandelaWallet,
} from "./core/wallet";
export { CandelaProvider, useCandela } from "./react/context";
export { useWallet } from "./react/useWallet";
export { useSubmit, type SubmitState } from "./react/useSubmit";
export { SignUpButton, SignInButton } from "./react/buttons";
```

- [ ] **Step 5: Run unit tests + typecheck**

Run: `pnpm --filter candela-kit test` → Expected: 4 passed.
Run: `pnpm --filter candela-kit typecheck` → Expected: clean.

- [ ] **Step 6: Commit**

```powershell
git add packages/candela-kit pnpm-lock.yaml
git commit -m "feat(candela): kit package — proven passkey+sponsor core, React provider/hooks/buttons"
```

---

### Task 7: Playground + ported Playwright regression (live testnet)

**Files:**
- Create: `packages/candela-kit/playground/index.html`, `playground/main.tsx`, `playground/vite.config.ts`, `playground/bindings.ts` (copied Probatum client), `tests/e2e/kit.spec.ts`, `playwright.config.ts`, `.env.example`

**Interfaces:**
- Consumes: kit public API (Task 6), NEW contract id (Task 4, from `deployments/testnet.json`), spike's e2e as the template (`packages/spike/tests/spike.spec.ts`), spike's generated bindings (`packages/spike/src/bindings/probatum/src/index.ts` — copy, keep its import patches).
- Produces: `pnpm --filter candela-kit e2e` → 1 passed against live testnet; this suite is Plan 3's regression gate.

- [ ] **Step 1: Playground page**

`playground/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  root: "playground",
  plugins: [react()],
  server: { port: 5174 },
  define: { global: "globalThis" },
});
```

`playground/index.html`:

```html
<!doctype html>
<html>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

`playground/main.tsx` (reads contract id + sponsor from Vite env; registers the new wallet as an issuer — same proof as the spike, now through the kit's public API):

```tsx
import { createRoot } from "react-dom/client";
import { useState } from "react";
import {
  CandelaProvider,
  SignUpButton,
  useSubmit,
  useWallet,
  useCandela,
} from "../src";
import { Client as ProbatumClient } from "./bindings";

const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID as string;

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
      publicKey: undefined as any, // set below per spike pattern
    } as any);
    const at = await (probatum as any).register_issuer({
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
```

NOTE: the ProbatumClient constructor options must mirror how the SPIKE constructed it (sponsor public key as `publicKey`) — read `packages/spike/src/main.ts` and copy that construction exactly, including any `Buffer` polyfill import the spike needed. Where this plan and the spike disagree, the spike wins; record deviations.

`playground/bindings.ts`: copy `packages/spike/src/bindings/probatum/src/index.ts` verbatim (imports already patched to `/minimal/*`).

`.env.example` (values blank): `VITE_CONTRACT_ID=`, `VITE_FALLBACK_SECRET=`. Copy real values into gitignored `.env` from `deployments/testnet.json` and `stellar keys show spike-sponsor`.

- [ ] **Step 2: Port the regression**

`playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  webServer: {
    command: "pnpm vite --config playground/vite.config.ts",
    port: 5174,
    reuseExistingServer: true,
  },
  use: { baseURL: "http://localhost:5174" },
});
```

`tests/e2e/kit.spec.ts` — port `packages/spike/tests/spike.spec.ts` (same CDP virtual-authenticator block, copied verbatim), driving the playground:

```ts
import { test, expect } from "@playwright/test";

test("kit: passkey wallet + sponsored register_issuer on live testnet", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: /sign up with passkey/i }).click();
  await expect(page.locator("#log")).toContainText("wallet-deployed:", {
    timeout: 90_000,
  });
  await page.click("#register");
  await expect(page.locator("#log")).toContainText("register_issuer-submitted:", {
    timeout: 90_000,
  });
  await expect(page.locator("#state")).toHaveText("confirmed");
});
```

- [ ] **Step 3: Run it live**

Run: `pnpm --filter candela-kit e2e`
Expected: 1 passed (fresh wallet on testnet, issuer registered on the v2 contract via the kit's public API). Verify independently: `stellar contract invoke --id <new-id> --network testnet --source probatum-admin -- get_issuer --issuer <walletId-from-log>` returns the sha256 of "candela-playground".

- [ ] **Step 4: Commit**

```powershell
git add packages/candela-kit
git commit -m "feat(candela): playground + live virtual-authenticator regression through the public API"
```

---

## Self-Review (performed at write time)

1. **Coverage vs. arguments/ledger:** __constructor ✅ (T1), Paused event + Result pause ✅ (T2), extend_ttl + who-bumps ✅ (T3, public bump_batch), ClaimCount ✅ (T3), one redeploy ✅ (T4), consumers repoint ✅ (T5, landing), kit API per spec §4.1 ✅ (T6: provider, buttons, useWallet, useSubmit, capability detection; TxButton/WalletBadge and Launchtube-primary UX deferred to Plan 3/4 — Launchtube path IS wired in `send()` behind config), regression ported ✅ (T7). CI sponsor-key strategy: deferred deliberately (ledger item stays open; e2e remains local-run).
2. **Placeholder scan:** T7's `publicKey: undefined as any` is flagged inline with the explicit instruction that the spike's construction is authoritative — a directed adaptation, not a TBD. No other placeholders.
3. **Type consistency:** `CandelaWallet {contractId, keyIdBase64}` consistent across core/react/playground; `ChainStats.genesisTx` produced (T5 chain.ts) before consumption (T5 HeroC); `DataKey::ClaimCount`/`bump_batch` names match between tasks; discriminants append-only (#11 NotInitialized) with tests still asserting #5 in T3.
