# Plan 1: Foundation & Contract — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo, implement and fully test the Probatum Soroban contract, deploy it to testnet, and prove the riskiest integration (passkey wallet + fee-sponsored submission) end-to-end.

**Architecture:** pnpm monorepo. One Rust Soroban contract (`contracts/probatum`) holds all on-chain state: issuer registry, merkle batch anchors, revocations, claims, admin pause. A throwaway spike package (`packages/spike`) proves passkey-kit + Launchtube against the testnet contract before we build Candela on those APIs in Plan 2.

**Tech Stack:** pnpm workspaces, TypeScript (strict), Rust + soroban-sdk, stellar CLI, Vite (spike only), Playwright (WebAuthn virtual authenticator), passkey-kit, Launchtube (testnet).

**Plan roadmap (this is 1 of 4):** Plan 2 = Candela kit + docs/playground. Plan 3 = Probatum app (issuer/cert/verify/claim flows). Plan 4 = landing pages, mainnet deploy, seeding/launch. Spec: `docs/superpowers/specs/2026-07-03-candela-probatum-design.md`.

## Global Constraints

- **No PII on-chain — hashes and addresses only.** No names, emails, or cert content in any contract call.
- **No tokens, no balances, nothing transferable** in the contract. It is a registry, not an asset.
- **Contract is open source (MIT).** Repo will be public before submission.
- **TDD:** every contract feature lands as failing test → minimal impl → passing test → commit.
- **Merkle scheme (must match TS side in Plan 3):** leaves are `sha256(canonical cert JSON bytes + salt)`; internal nodes are `sha256(min(a,b) || max(a,b))` (sorted-pair, so no index bookkeeping).
- **Windows dev box:** all commands below are PowerShell-compatible; use `pnpm` (never npm/yarn).
- Node ≥ 20, pnpm ≥ 9, Rust stable ≥ 1.85, stellar CLI ≥ 23.
- Commit after every task minimum; prefer after every green test cycle.

## File Structure (created in this plan)

```
package.json                     # workspace root, scripts
pnpm-workspace.yaml
.gitignore
.npmrc
docs/DEV.md                      # toolchain setup notes (Windows)
contracts/Cargo.toml             # cargo workspace
contracts/probatum/Cargo.toml
contracts/probatum/src/lib.rs    # contract: types, storage keys, errors
                                 # + impl (single focused file, ~350 lines)
contracts/probatum/src/test.rs   # unit tests
scripts/deploy-testnet.ps1       # keygen, fund, build, deploy, init
deployments/testnet.json         # contract id + wasm hash (committed)
packages/spike/package.json      # throwaway Vite app
packages/spike/index.html
packages/spike/src/main.ts       # passkey wallet + sponsored contract call
packages/spike/.env.example
packages/spike/tests/spike.spec.ts  # Playwright + virtual authenticator
packages/spike/playwright.config.ts
```

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.npmrc`

**Interfaces:**
- Produces: workspace layout every later task installs into; root scripts `test:contract`, `build:contract`.

- [ ] **Step 1: Create root files**

`package.json`:
```json
{
  "name": "candela-probatum",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build:contract": "stellar contract build --manifest-path contracts/Cargo.toml",
    "test:contract": "cargo test --manifest-path contracts/Cargo.toml",
    "spike": "pnpm --filter spike dev",
    "spike:test": "pnpm --filter spike test"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`.gitignore`:
```
node_modules/
dist/
.next/
target/
.env
.env.local
test-results/
playwright-report/
```

`.npmrc`:
```
engine-strict=true
```

- [ ] **Step 2: Verify workspace resolves**

Run: `pnpm install`
Expected: completes with no packages yet, creates `pnpm-lock.yaml`, no errors.

- [ ] **Step 3: Commit**

```powershell
git add package.json pnpm-workspace.yaml .gitignore .npmrc pnpm-lock.yaml
git commit -m "chore: scaffold pnpm monorepo"
```

---

### Task 2: Toolchain verification + DEV.md

**Files:**
- Create: `docs/DEV.md`

**Interfaces:**
- Produces: a machine that can build Soroban contracts; documented setup for any future contributor/agent.

- [ ] **Step 1: Verify/install each tool, recording exact versions**

Run each; if missing, install with the command in parentheses:

```powershell
node --version        # expect >= v20   (winget install OpenJS.NodeJS.LTS)
corepack enable; pnpm --version   # expect >= 9
rustup --version      # (winget install Rustlang.Rustup; rustup default stable)
rustc --version       # expect >= 1.85
rustup target add wasm32v1-none   # Soroban build target (SDK >= 22)
stellar --version     # expect >= 23  (winget install --id StellarDevelopmentFoundation.StellarCLI, or: cargo install stellar-cli --locked)
```

Expected: every command prints a version meeting the floor. If `wasm32v1-none` is unavailable on the installed Rust, run `rustup update` first.

- [ ] **Step 2: Write `docs/DEV.md`** capturing: the five commands above with the versions you actually recorded, plus one line — "Contracts build with `pnpm build:contract`; tests with `pnpm test:contract`."

- [ ] **Step 3: Commit**

```powershell
git add docs/DEV.md
git commit -m "docs: toolchain setup for Windows"
```

---

### Task 3: Contract crate scaffold (compiles + empty test passes)

**Files:**
- Create: `contracts/Cargo.toml`, `contracts/probatum/Cargo.toml`, `contracts/probatum/src/lib.rs`, `contracts/probatum/src/test.rs`

**Interfaces:**
- Produces: `ProbatumContract` + `ProbatumContractClient` (generated) that all later tasks extend.

- [ ] **Step 1: Create cargo workspace files**

`contracts/Cargo.toml`:
```toml
[workspace]
resolver = "2"
members = ["probatum"]

[workspace.dependencies]
soroban-sdk = "23"

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
```

`contracts/probatum/Cargo.toml`:
```toml
[package]
name = "probatum"
version = "0.1.0"
edition = "2021"
license = "MIT"
publish = false

[lib]
crate-type = ["cdylib"]
doctest = false

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
```

Note: if `cargo build` reports no matching soroban-sdk version, run `cargo search soroban-sdk --limit 1` and pin the latest major — the API used below is stable across 21→23.

- [ ] **Step 2: Create minimal contract + smoke test**

`contracts/probatum/src/lib.rs`:
```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct ProbatumContract;

#[contractimpl]
impl ProbatumContract {
    pub fn version(_env: Env) -> u32 {
        1
    }
}

mod test;
```

`contracts/probatum/src/test.rs`:
```rust
#![cfg(test)]
use super::*;
use soroban_sdk::Env;

#[test]
fn test_version() {
    let env = Env::default();
    let id = env.register(ProbatumContract, ());
    let client = ProbatumContractClient::new(&env, &id);
    assert_eq!(client.version(), 1);
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test:contract`
Expected: `test test::test_version ... ok`

- [ ] **Step 4: Verify Wasm builds**

Run: `pnpm build:contract`
Expected: writes `contracts/target/wasm32v1-none/release/probatum.wasm` (path printed by CLI).

- [ ] **Step 5: Commit**

```powershell
git add contracts/
git commit -m "feat(contract): scaffold probatum crate, version() smoke test"
```

---

### Task 4: Contract types, init, admin pause

**Files:**
- Modify: `contracts/probatum/src/lib.rs`, `contracts/probatum/src/test.rs`

**Interfaces:**
- Produces (used by every later task): `Error` enum, `DataKey` enum, `Batch` struct, `init(admin)`, `pause(bool)` (admin-gated), internal `require_not_paused(&Env)`.

- [ ] **Step 1: Write failing tests**

Append to `test.rs`:
```rust
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Address;

fn setup() -> (Env, ProbatumContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(ProbatumContract, ());
    let client = ProbatumContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.init(&admin);
    (env, client, admin)
}

#[test]
fn test_init_and_pause() {
    let (_env, client, _admin) = setup();
    assert_eq!(client.is_paused(), false);
    client.pause(&true);
    assert_eq!(client.is_paused(), true);
    client.pause(&false);
    assert_eq!(client.is_paused(), false);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // AlreadyInitialized
fn test_double_init_panics() {
    let (env, client, _admin) = setup();
    let admin2 = Address::generate(&env);
    client.init(&admin2);
}
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:contract`
Expected: FAIL — `init` not found.

- [ ] **Step 3: Implement**

Replace `lib.rs` contents above `mod test;` with:
```rust
#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Bytes, BytesN, Env, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    Paused = 2,
    AlreadyRegistered = 3,
    NotRegistered = 4,
    BatchNotFound = 5,
    NotBatchIssuer = 6,
    BatchRevoked = 7,
    LeafRevoked = 8,
    AlreadyClaimed = 9,
    InvalidProof = 10,
}

#[contracttype]
#[derive(Clone)]
pub struct Batch {
    pub issuer: Address,
    pub root: BytesN<32>,
    pub meta: BytesN<32>,
    pub count: u32,
    pub revoked: bool,
    pub anchored_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    BatchSeq,
    Issuer(Address),
    Batch(u64),
    RevokedLeaf(u64, BytesN<32>),
    Claim(u64, BytesN<32>),
}

fn require_not_paused(env: &Env) -> Result<(), Error> {
    let paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false);
    if paused {
        return Err(Error::Paused);
    }
    Ok(())
}

#[contract]
pub struct ProbatumContract;

#[contractimpl]
impl ProbatumContract {
    pub fn version(_env: Env) -> u32 {
        1
    }

    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::BatchSeq, &0u64);
        Ok(())
    }

    pub fn pause(env: Env, paused: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }
}

mod test;
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:contract`
Expected: 3 tests pass (`test_version`, `test_init_and_pause`, `test_double_init_panics`).

- [ ] **Step 5: Commit**

```powershell
git add contracts/probatum/src/
git commit -m "feat(contract): init, admin pause, error/type foundations"
```

---

### Task 5: Issuer registry

**Files:**
- Modify: `contracts/probatum/src/lib.rs`, `contracts/probatum/src/test.rs`

**Interfaces:**
- Produces: `register_issuer(issuer, profile_hash)`, `update_issuer(issuer, profile_hash)`, `get_issuer(issuer) -> Option<BytesN<32>>`. Auth: `issuer.require_auth()` on both writes.

- [ ] **Step 1: Write failing tests**

Append to `test.rs`:
```rust
use soroban_sdk::BytesN;

fn h(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

#[test]
fn test_register_and_update_issuer() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    assert_eq!(client.get_issuer(&issuer), None);
    client.register_issuer(&issuer, &h(&env, 1));
    assert_eq!(client.get_issuer(&issuer), Some(h(&env, 1)));
    client.update_issuer(&issuer, &h(&env, 2));
    assert_eq!(client.get_issuer(&issuer), Some(h(&env, 2)));
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")] // AlreadyRegistered
fn test_double_register_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    client.register_issuer(&issuer, &h(&env, 1));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // NotRegistered
fn test_update_unregistered_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    client.update_issuer(&issuer, &h(&env, 1));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")] // Paused
fn test_register_while_paused_panics() {
    let (env, client, _admin) = setup();
    client.pause(&true);
    let issuer = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
}
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test:contract` — Expected: FAIL, `register_issuer` not found.

- [ ] **Step 3: Implement** (append inside `impl ProbatumContract`)

```rust
    pub fn register_issuer(env: Env, issuer: Address, profile_hash: BytesN<32>) -> Result<(), Error> {
        require_not_paused(&env)?;
        issuer.require_auth();
        let key = DataKey::Issuer(issuer.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyRegistered);
        }
        env.storage().persistent().set(&key, &profile_hash);
        env.events()
            .publish((soroban_sdk::symbol_short!("issuer"), issuer), profile_hash);
        Ok(())
    }

    pub fn update_issuer(env: Env, issuer: Address, profile_hash: BytesN<32>) -> Result<(), Error> {
        require_not_paused(&env)?;
        issuer.require_auth();
        let key = DataKey::Issuer(issuer.clone());
        if !env.storage().persistent().has(&key) {
            return Err(Error::NotRegistered);
        }
        env.storage().persistent().set(&key, &profile_hash);
        env.events()
            .publish((soroban_sdk::symbol_short!("issuer"), issuer), profile_hash);
        Ok(())
    }

    pub fn get_issuer(env: Env, issuer: Address) -> Option<BytesN<32>> {
        env.storage().persistent().get(&DataKey::Issuer(issuer))
    }
```

- [ ] **Step 4: Run tests** — Expected: all 7 pass.

- [ ] **Step 5: Commit**

```powershell
git add contracts/probatum/src/
git commit -m "feat(contract): issuer registry with auth, pause gating, events"
```

---

### Task 6: Batch anchoring

**Files:**
- Modify: `contracts/probatum/src/lib.rs`, `contracts/probatum/src/test.rs`

**Interfaces:**
- Produces: `anchor_batch(issuer, root, meta, count) -> u64` (sequential ids starting at 1), `get_batch(batch_id) -> Option<Batch>`, `batch_count() -> u64`. Only registered issuers; `anchored_at` = ledger timestamp.

- [ ] **Step 1: Write failing tests**

```rust
#[test]
fn test_anchor_batch() {
    let (env, client, _admin) = setup();
    env.ledger().set_timestamp(1_720_000_000);
    let issuer = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    let id1 = client.anchor_batch(&issuer, &h(&env, 10), &h(&env, 11), &500u32);
    let id2 = client.anchor_batch(&issuer, &h(&env, 20), &h(&env, 21), &50u32);
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(client.batch_count(), 2);
    let b = client.get_batch(&id1).unwrap();
    assert_eq!(b.issuer, issuer);
    assert_eq!(b.root, h(&env, 10));
    assert_eq!(b.count, 500);
    assert_eq!(b.revoked, false);
    assert_eq!(b.anchored_at, 1_720_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // NotRegistered
fn test_anchor_unregistered_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    client.anchor_batch(&issuer, &h(&env, 10), &h(&env, 11), &1u32);
}
```

Add `use soroban_sdk::testutils::Ledger;` to the test imports.

- [ ] **Step 2: Run to verify failure** — Expected: FAIL, `anchor_batch` not found.

- [ ] **Step 3: Implement** (append inside impl)

```rust
    pub fn anchor_batch(
        env: Env,
        issuer: Address,
        root: BytesN<32>,
        meta: BytesN<32>,
        count: u32,
    ) -> Result<u64, Error> {
        require_not_paused(&env)?;
        issuer.require_auth();
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Issuer(issuer.clone()))
        {
            return Err(Error::NotRegistered);
        }
        let seq: u64 = env.storage().instance().get(&DataKey::BatchSeq).unwrap_or(0);
        let batch_id = seq + 1;
        let batch = Batch {
            issuer: issuer.clone(),
            root: root.clone(),
            meta,
            count,
            revoked: false,
            anchored_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&DataKey::Batch(batch_id), &batch);
        env.storage().instance().set(&DataKey::BatchSeq, &batch_id);
        env.events()
            .publish((soroban_sdk::symbol_short!("anchor"), issuer, batch_id), root);
        Ok(batch_id)
    }

    pub fn get_batch(env: Env, batch_id: u64) -> Option<Batch> {
        env.storage().persistent().get(&DataKey::Batch(batch_id))
    }

    pub fn batch_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::BatchSeq).unwrap_or(0)
    }
```

- [ ] **Step 4: Run tests** — Expected: all 9 pass.

- [ ] **Step 5: Commit**

```powershell
git add contracts/probatum/src/
git commit -m "feat(contract): merkle batch anchoring with sequential ids"
```

---

### Task 7: Revocation (batch + leaf)

**Files:**
- Modify: `contracts/probatum/src/lib.rs`, `contracts/probatum/src/test.rs`

**Interfaces:**
- Produces: `revoke_batch(issuer, batch_id)`, `revoke_leaf(issuer, batch_id, leaf_hash)`, `is_batch_revoked(batch_id) -> bool`, `is_leaf_revoked(batch_id, leaf_hash) -> bool`. **Design note (refines spec §6):** leaf revocation is keyed by `leaf_hash`, not index — same identifier the claim path uses; removes index bookkeeping.

- [ ] **Step 1: Write failing tests**

```rust
#[test]
fn test_revocation() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    let bid = client.anchor_batch(&issuer, &h(&env, 10), &h(&env, 11), &10u32);
    assert_eq!(client.is_batch_revoked(&bid), false);
    assert_eq!(client.is_leaf_revoked(&bid, &h(&env, 42)), false);
    client.revoke_leaf(&issuer, &bid, &h(&env, 42));
    assert_eq!(client.is_leaf_revoked(&bid, &h(&env, 42)), true);
    client.revoke_batch(&issuer, &bid);
    assert_eq!(client.is_batch_revoked(&bid), true);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // NotBatchIssuer
fn test_revoke_by_stranger_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    let stranger = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    client.register_issuer(&stranger, &h(&env, 2));
    let bid = client.anchor_batch(&issuer, &h(&env, 10), &h(&env, 11), &10u32);
    client.revoke_batch(&stranger, &bid);
}
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL, `revoke_leaf` not found.

- [ ] **Step 3: Implement** (append inside impl; plus private helper above impl block)

```rust
fn load_batch_checked(env: &Env, issuer: &Address, batch_id: u64) -> Result<Batch, Error> {
    let batch: Batch = env
        .storage()
        .persistent()
        .get(&DataKey::Batch(batch_id))
        .ok_or(Error::BatchNotFound)?;
    if batch.issuer != *issuer {
        return Err(Error::NotBatchIssuer);
    }
    Ok(batch)
}
```

```rust
    pub fn revoke_batch(env: Env, issuer: Address, batch_id: u64) -> Result<(), Error> {
        require_not_paused(&env)?;
        issuer.require_auth();
        let mut batch = load_batch_checked(&env, &issuer, batch_id)?;
        batch.revoked = true;
        env.storage().persistent().set(&DataKey::Batch(batch_id), &batch);
        env.events()
            .publish((soroban_sdk::symbol_short!("revokeb"), batch_id), ());
        Ok(())
    }

    pub fn revoke_leaf(
        env: Env,
        issuer: Address,
        batch_id: u64,
        leaf_hash: BytesN<32>,
    ) -> Result<(), Error> {
        require_not_paused(&env)?;
        issuer.require_auth();
        load_batch_checked(&env, &issuer, batch_id)?;
        env.storage()
            .persistent()
            .set(&DataKey::RevokedLeaf(batch_id, leaf_hash.clone()), &true);
        env.events()
            .publish((soroban_sdk::symbol_short!("revokel"), batch_id), leaf_hash);
        Ok(())
    }

    pub fn is_batch_revoked(env: Env, batch_id: u64) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Batch(batch_id))
            .map(|b: Batch| b.revoked)
            .unwrap_or(false)
    }

    pub fn is_leaf_revoked(env: Env, batch_id: u64, leaf_hash: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::RevokedLeaf(batch_id, leaf_hash))
            .unwrap_or(false)
    }
```

- [ ] **Step 4: Run tests** — Expected: all 11 pass.

- [ ] **Step 5: Commit**

```powershell
git add contracts/probatum/src/
git commit -m "feat(contract): batch and leaf revocation, issuer-gated"
```

---

### Task 8: Merkle verification + claim

**Files:**
- Modify: `contracts/probatum/src/lib.rs`, `contracts/probatum/src/test.rs`

**Interfaces:**
- Produces: `claim(recipient, batch_id, leaf_hash, proof: Vec<BytesN<32>>)`, `claim_of(batch_id, leaf_hash) -> Option<Address>`, `claim_count() -> u64`. Proof verification: sorted-pair sha256 (see Global Constraints). Plan 3's TS hashing MUST reproduce this exactly.

- [ ] **Step 1: Write failing tests** (test builds a real 4-leaf tree with the same sorted-pair rule)

```rust
use soroban_sdk::Bytes;

fn pair(env: &Env, a: &BytesN<32>, b: &BytesN<32>) -> BytesN<32> {
    let (lo, hi) = if a < b { (a, b) } else { (b, a) };
    let mut buf = Bytes::new(env);
    buf.append(&Bytes::from_slice(env, &lo.to_array()));
    buf.append(&Bytes::from_slice(env, &hi.to_array()));
    env.crypto().sha256(&buf).into()
}

#[test]
fn test_claim_with_valid_proof() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    let alice = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));

    // 4 leaves; alice owns leaf_a
    let (la, lb, lc, ld) = (h(&env, 101), h(&env, 102), h(&env, 103), h(&env, 104));
    let n_ab = pair(&env, &la, &lb);
    let n_cd = pair(&env, &lc, &ld);
    let root = pair(&env, &n_ab, &n_cd);
    let bid = client.anchor_batch(&issuer, &root, &h(&env, 0), &4u32);

    let proof = soroban_sdk::vec![&env, lb.clone(), n_cd.clone()];
    client.claim(&alice, &bid, &la, &proof);
    assert_eq!(client.claim_of(&bid, &la), Some(alice.clone()));
    assert_eq!(client.claim_count(), 1);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")] // InvalidProof
fn test_claim_bad_proof_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    let alice = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    let bid = client.anchor_batch(&issuer, &h(&env, 99), &h(&env, 0), &4u32);
    let proof = soroban_sdk::vec![&env, h(&env, 1)];
    client.claim(&alice, &bid, &h(&env, 101), &proof);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")] // AlreadyClaimed
fn test_double_claim_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    let (la, lb) = (h(&env, 101), h(&env, 102));
    let root = pair(&env, &la, &lb);
    let bid = client.anchor_batch(&issuer, &root, &h(&env, 0), &2u32);
    let proof = soroban_sdk::vec![&env, lb.clone()];
    client.claim(&alice, &bid, &la, &proof);
    client.claim(&bob, &bid, &la, &proof);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")] // LeafRevoked
fn test_claim_revoked_leaf_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    let alice = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    let (la, lb) = (h(&env, 101), h(&env, 102));
    let root = pair(&env, &la, &lb);
    let bid = client.anchor_batch(&issuer, &root, &h(&env, 0), &2u32);
    client.revoke_leaf(&issuer, &bid, &la);
    let proof = soroban_sdk::vec![&env, lb.clone()];
    client.claim(&alice, &bid, &la, &proof);
}
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL, `claim` not found.

- [ ] **Step 3: Implement**

Private helpers (above impl block):
```rust
fn hash_pair(env: &Env, a: &BytesN<32>, b: &BytesN<32>) -> BytesN<32> {
    let (lo, hi) = if a < b { (a, b) } else { (b, a) };
    let mut buf = Bytes::new(env);
    buf.append(&Bytes::from_slice(env, &lo.to_array()));
    buf.append(&Bytes::from_slice(env, &hi.to_array()));
    env.crypto().sha256(&buf).into()
}

fn verify_proof(env: &Env, leaf: &BytesN<32>, proof: &Vec<BytesN<32>>, root: &BytesN<32>) -> bool {
    let mut node = leaf.clone();
    for sib in proof.iter() {
        node = hash_pair(env, &node, &sib);
    }
    node == *root
}
```

Public functions (inside impl):
```rust
    pub fn claim(
        env: Env,
        recipient: Address,
        batch_id: u64,
        leaf_hash: BytesN<32>,
        proof: Vec<BytesN<32>>,
    ) -> Result<(), Error> {
        require_not_paused(&env)?;
        recipient.require_auth();
        let batch: Batch = env
            .storage()
            .persistent()
            .get(&DataKey::Batch(batch_id))
            .ok_or(Error::BatchNotFound)?;
        if batch.revoked {
            return Err(Error::BatchRevoked);
        }
        if Self::is_leaf_revoked(env.clone(), batch_id, leaf_hash.clone()) {
            return Err(Error::LeafRevoked);
        }
        let claim_key = DataKey::Claim(batch_id, leaf_hash.clone());
        if env.storage().persistent().has(&claim_key) {
            return Err(Error::AlreadyClaimed);
        }
        if !verify_proof(&env, &leaf_hash, &proof, &batch.root) {
            return Err(Error::InvalidProof);
        }
        env.storage().persistent().set(&claim_key, &recipient);
        let claims: u64 = env
            .storage()
            .instance()
            .get(&soroban_sdk::symbol_short!("claims"))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&soroban_sdk::symbol_short!("claims"), &(claims + 1));
        env.events()
            .publish((soroban_sdk::symbol_short!("claim"), batch_id, recipient), leaf_hash);
        Ok(())
    }

    pub fn claim_of(env: Env, batch_id: u64, leaf_hash: BytesN<32>) -> Option<Address> {
        env.storage().persistent().get(&DataKey::Claim(batch_id, leaf_hash))
    }

    pub fn claim_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&soroban_sdk::symbol_short!("claims"))
            .unwrap_or(0)
    }
```

- [ ] **Step 4: Run tests** — Expected: all 15 pass.

- [ ] **Step 5: Full suite + Wasm build + commit**

Run: `pnpm test:contract` then `pnpm build:contract`
Expected: 15/15 pass; release Wasm produced (typically < 10 KB — sanity-check it's not bloated).

```powershell
git add contracts/probatum/src/
git commit -m "feat(contract): merkle-proof claims with revocation + double-claim guards"
```

---

### Task 9: Testnet deployment script

**Files:**
- Create: `scripts/deploy-testnet.ps1`, `deployments/testnet.json` (generated then committed)

**Interfaces:**
- Produces: deployed testnet contract; `deployments/testnet.json` `{ "network", "contractId", "wasmHash", "adminPublic", "deployedAt" }` — consumed by the spike (Task 10) and by Plan 3.

- [ ] **Step 1: Write `scripts/deploy-testnet.ps1`**

```powershell
$ErrorActionPreference = "Stop"

# 1. Identity (idempotent): stellar CLI stores keys in its config dir
$who = "probatum-admin"
try { stellar keys address $who | Out-Null } catch { stellar keys generate $who --network testnet }
$admin = stellar keys address $who
Write-Host "Admin: $admin"

# 2. Fund via friendbot (idempotent, ignores already-funded errors)
try { stellar keys fund $who --network testnet } catch { Write-Host "fund skipped: $_" }

# 3. Build + deploy
stellar contract build --manifest-path contracts/Cargo.toml
$wasm = "contracts/target/wasm32v1-none/release/probatum.wasm"
$contractId = stellar contract deploy --wasm $wasm --source $who --network testnet
Write-Host "Contract: $contractId"

# 4. Init with admin
stellar contract invoke --id $contractId --source $who --network testnet -- init --admin $admin

# 5. Record deployment
$wasmHash = (Get-FileHash $wasm -Algorithm SHA256).Hash.ToLower()
$out = @{ network = "testnet"; contractId = "$contractId"; wasmHash = $wasmHash;
          adminPublic = "$admin"; deployedAt = (Get-Date).ToUniversalTime().ToString("o") } | ConvertTo-Json
New-Item -ItemType Directory -Force deployments | Out-Null
$out | Out-File -Encoding utf8 deployments/testnet.json
Write-Host $out
```

- [ ] **Step 2: Run it**

Run: `powershell -File scripts/deploy-testnet.ps1`
Expected: prints admin address, contract id (starts with `C`), writes `deployments/testnet.json`.

- [ ] **Step 3: Smoke-test on-chain state**

```powershell
$id = (Get-Content deployments/testnet.json | ConvertFrom-Json).contractId
stellar contract invoke --id $id --network testnet --source probatum-admin -- version
stellar contract invoke --id $id --network testnet --source probatum-admin -- batch_count
```
Expected: `1` and `0`.

- [ ] **Step 4: Commit**

```powershell
git add scripts/deploy-testnet.ps1 deployments/testnet.json
git commit -m "feat: testnet deployment script + first deployed contract"
```

---

### Task 10: Passkey + sponsored-submission spike

**Files:**
- Create: `packages/spike/package.json`, `packages/spike/index.html`, `packages/spike/src/main.ts`, `packages/spike/.env.example`, `packages/spike/playwright.config.ts`, `packages/spike/tests/spike.spec.ts`

**Interfaces:**
- Produces: PROOF that (a) a passkey creates a smart wallet on testnet, (b) that wallet signs `register_issuer` on our deployed contract, (c) submission works fee-sponsored (Launchtube) **and** via fallback (local fee-bump with funded key). Plan 2 (Candela) wraps exactly the working code paths discovered here.
- Consumes: `deployments/testnet.json` from Task 9.

**Spike ground rules:** `passkey-kit`'s API has iterated; the code below is the reference integration for its documented shape (`PasskeyKit` client + `PasskeyServer`) — adapting names/options to the installed version **is the point of the spike**. The acceptance criteria are fixed; the exact call names may drift. Read the README of the installed version first: https://github.com/kalepail/passkey-kit

- [ ] **Step 1: Scaffold the spike package**

`packages/spike/package.json`:
```json
{
  "name": "spike",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "playwright test"
  },
  "dependencies": {
    "passkey-kit": "latest",
    "@stellar/stellar-sdk": "latest"
  },
  "devDependencies": {
    "vite": "^6",
    "typescript": "^5",
    "@playwright/test": "^1.50"
  }
}
```

`packages/spike/.env.example`:
```
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_CONTRACT_ID=   # from deployments/testnet.json
VITE_LAUNCHTUBE_URL=https://testnet.launchtube.xyz
VITE_LAUNCHTUBE_JWT=   # claim a testnet token; leave empty to use fallback path
VITE_FALLBACK_SECRET=  # testnet secret key of a friendbot-funded account (fallback sponsor)
```

`packages/spike/index.html`:
```html
<!doctype html>
<html>
  <body>
    <h1>Candela spike</h1>
    <button id="create">1. Create passkey wallet</button>
    <button id="register" disabled>2. register_issuer (sponsored)</button>
    <pre id="log"></pre>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Write the spike logic** — `packages/spike/src/main.ts`:

```ts
import { PasskeyKit, PasskeyServer } from "passkey-kit";

const log = (m: unknown) => {
  console.log(m);
  document.querySelector("#log")!.textContent += JSON.stringify(m, null, 2) + "\n";
};

const kit = new PasskeyKit({
  rpcUrl: import.meta.env.VITE_RPC_URL,
  networkPassphrase: import.meta.env.VITE_NETWORK_PASSPHRASE,
  // walletWasmHash: see passkey-kit README for the current testnet smart-wallet wasm hash
});

const server = new PasskeyServer({
  rpcUrl: import.meta.env.VITE_RPC_URL,
  launchtubeUrl: import.meta.env.VITE_LAUNCHTUBE_URL,
  launchtubeJwt: import.meta.env.VITE_LAUNCHTUBE_JWT,
});

let walletId: string | undefined;

document.querySelector("#create")!.addEventListener("click", async () => {
  const res = await kit.createWallet("Candela Spike", "spike-user");
  walletId = res.contractId;
  log({ step: "wallet-created", contractId: res.contractId });
  // send the wallet-deployment tx through Launchtube (or fallback)
  await server.send(res.signedTx);
  log({ step: "wallet-deployed" });
  (document.querySelector("#register") as HTMLButtonElement).disabled = false;
});

document.querySelector("#register")!.addEventListener("click", async () => {
  // Build register_issuer(walletId, sha256("spike-profile")) against VITE_CONTRACT_ID,
  // sign with kit.sign(...), submit with server.send(...).
  // Exact assembly uses @stellar/stellar-sdk contract bindings — see spike notes.
  const profileHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode("spike-profile")),
  );
  const tx = await kit.sign(
    await buildRegisterIssuer(walletId!, profileHash), // helper below
    { keyId: "spike-user" },
  );
  const res = await server.send(tx);
  log({ step: "register_issuer-submitted", res });
});

// buildRegisterIssuer: assemble the Soroban invocation with @stellar/stellar-sdk
// (Contract(...).call("register_issuer", Address, BytesN<32>) → assembled tx).
// Implemented during the spike against the installed SDK version.
async function buildRegisterIssuer(_wallet: string, _profile: Uint8Array): Promise<any> {
  throw new Error("implement during spike against installed SDK");
}
```

- [ ] **Step 3: Manual spike run (the real work)**

Run: `pnpm install`, copy `.env.example` → `.env` and fill `VITE_CONTRACT_ID`, then `pnpm spike` and open the printed localhost URL in Chrome. Work the two buttons until both succeed, adapting API calls to the installed `passkey-kit` version. Get a Launchtube testnet JWT (self-serve at testnet.launchtube.xyz; if unavailable today, implement the fallback: fee-bump submission from `VITE_FALLBACK_SECRET` using `@stellar/stellar-sdk` — the fallback is a spec deliverable regardless).

**Acceptance criteria (all must hold):**
1. Chrome passkey prompt → smart wallet contract exists on testnet (visible on stellar.expert).
2. `register_issuer` invocation signed by that wallet succeeds; `get_issuer` returns the profile hash (verify with `stellar contract invoke ... -- get_issuer --issuer <walletId>`).
3. The submitting account paid the fees — not the passkey wallet (check the tx on stellar.expert).
4. Both submission paths exercised: Launchtube AND local fee-bump fallback (or fallback alone if Launchtube token unobtainable — record which in DEV.md).

- [ ] **Step 4: Freeze what worked into an automated regression**

`packages/spike/playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  webServer: { command: "pnpm dev", port: 5173, reuseExistingServer: true },
  use: { baseURL: "http://localhost:5173" },
});
```

`packages/spike/tests/spike.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("passkey wallet creation via virtual authenticator", async ({ page }) => {
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
  await page.click("#create");
  await expect(page.locator("#log")).toContainText("wallet-deployed", { timeout: 60_000 });
  await page.click("#register");
  await expect(page.locator("#log")).toContainText("register_issuer-submitted", {
    timeout: 60_000,
  });
});
```

Run: `pnpm spike:test`
Expected: PASS (this test becomes the seed of Candela's test suite in Plan 2).

- [ ] **Step 5: Document findings + commit**

Append to `docs/DEV.md`: which passkey-kit version/APIs worked, the wallet wasm hash used, Launchtube status (token obtained or fallback used), any browser quirks observed.

```powershell
git add packages/spike/ docs/DEV.md
git commit -m "feat(spike): passkey wallet + sponsored register_issuer proven on testnet"
```

---

## Self-Review (performed at write time)

1. **Spec coverage (Plan 1 scope = spec §6, §7-monorepo, §10-contract-tests, days 1–5 of §11):** contract interface ✅ (all §6 functions; `revoke_leaf` keyed by hash — deviation documented in Task 7), unit tests all paths ✅, testnet deploy ✅, spike ✅. Remaining spec sections are Plans 2–4 by design.
2. **Placeholder scan:** one intentional exception — `buildRegisterIssuer` throws in Task 10 Step 2: that task IS the discovery spike, with fixed acceptance criteria and a frozen regression test as its deliverable. No other TBDs.
3. **Type consistency:** `Error` discriminants match every `#[should_panic]` string; `h()`/`pair()` helpers defined before first use; `DataKey::RevokedLeaf(u64, BytesN<32>)` matches Task 7/8 usage; `deployments/testnet.json` keys match Task 9 producer and Task 10 consumer.
