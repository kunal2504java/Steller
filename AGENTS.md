# AGENTS.md — Candela + Probatum

Handoff doc for any coding agent working in this repo. Read this fully before touching anything.
Written 2026-07-12, at the point where Plan 3 merged to `main` (`984500b`).

---

## 1. What this repo is (30 seconds)

Two products, one monorepo, built for the **Stellar Build Station** (21-day Rise In + SDF builder sprint, India → Instawards up to $15K → SCF Build Award up to $150K).

- **Candela** (`packages/candela-kit` + `apps/candela`) — an **open-source React/TypeScript passkey-onboarding kit for Stellar**. Thesis: *"Web3 UX should not suck."* Turns a fingerprint into a Stellar smart wallet and a sponsored transaction: no seed phrase, no extension, no gas. This targets SCF's active **Passkey UI RFP** — it is the strategically primary, fundable product.
- **Probatum** (`contracts/probatum` + `apps/probatum`) — **verifiable certificates for India's long-tail issuers** (hackathons, fests, coaching centres, NGOs — everyone DigiLocker forgot). Certificates are merkle-hashed into a batch; one root is anchored on a Soroban contract. Anyone can verify forever, even if the issuer (or we) disappear. This is **Candela's flagship use case** — proof the kit builds real things.

Framing that governs everything: **Candela is the product; Probatum is what proves it.**

The user's hard requirements (from day one, still binding): easily adoptable · solves a real India pain point · **no regulatory BS** · easy to use · reduces friction of an everyday task · **deployed on Stellar mainnet** · a killer landing page.

---

## 2. Current state — what exists and what's live

| Thing | Status |
|---|---|
| Soroban contract v2 | **LIVE on testnet**, `CDB6674ZKXTKH6M25CJY75EAOWXE44G7VH3ZI7VNGDZHD475KXDQR3YV`, 19 Rust tests green |
| `candela-kit` | Built + **proven end-to-end on live testnet** through its public React API. Publish-ready, **NOT published (gated)** |
| `apps/probatum` (landing) | Complete — monochrome landing page, live on-chain stats |
| `apps/candela` (dev landing) | Complete — builds clean, fully verified, merged `984500b` |
| Probatum app flows (issue/verify/claim/share) | **Not built** — this is the next work |
| Contract rev (v3) | **Not done** — consolidated redeploy, see §8 |
| Mainnet | **Not deployed** — testnet only so far |
| Public deploy (Vercel/domain) | **Not done** — user is buying a domain (leaning `candela.dev` / `probatum.app`) |

**Live proof that the whole stack works** (from Plan 2, on testnet): a Playwright virtual authenticator created a passkey → smart wallet `CD67ZP6EXIQTFILVEMB6JIFJ47TVIGMKUA7JDY4A2YBMRABZNDYWWXIG` → landed a sponsored `register_issuer` in tx `2da1289548f8227342ce70fa46225572dfd50d6adbb3af5b650dfee385caf484`. That is not a mock. The kit really does this.

---

## 3. Repo map

```
contracts/probatum/src/lib.rs   the Soroban contract (v2) — merkle batch anchoring
contracts/probatum/src/test.rs  19 tests; setup idiom: env.register(ProbatumContract, (admin.clone(),))
packages/candela-kit/           THE KIT (the product). src/core + src/react, tests, playground
packages/spike/                 FROZEN Plan-1 spike. src/main.ts is the AUTHORITY for passkey call sequences
apps/probatum/                  Probatum landing page (Next 15, port 3000, pkg name "probatum-web")
apps/candela/                   Candela dev landing page (Next 15, port 3001, pkg name "candela-web")
deployments/testnet.json        SINGLE SOURCE OF TRUTH for on-chain values — never hardcode a contract id
scripts/deploy-testnet.ps1      constructor deploy + genesis seeding (PowerShell)
docs/DEV.md                     toolchain, Windows PATH quirk, spike findings, dev-vs-build clash
docs/superpowers/specs/         approved design specs (read these before planning)
docs/superpowers/plans/         executed implementation plans (Plans 1–3)
.superpowers/sdd/progress.md    THE DURABLE LEDGER — gitignored, local only. Richest knowledge source.
```

> **⚠️ `.superpowers/` is gitignored.** The ledger (`progress.md`) and all per-task reports live there and will **not** survive a fresh clone. On this machine they exist — read `.superpowers/sdd/progress.md` first, it is the single most valuable file for context. If it's gone, reconstruct from `git log` (commit messages are descriptive and scoped).

---

## 4. Toolchain — exact pins, do not drift

Verified on this machine (Windows 11, PowerShell 5.1). Full detail in `docs/DEV.md`.

```
node 22.17.0   pnpm 9.15.0   rustc 1.91.1   stellar CLI 27.0.0   soroban-sdk 23.5.3
target: wasm32v1-none
```

Locked dependency versions (**changing these breaks things — see §6**):

```
passkey-kit           0.11.3      # 0.12+ needs Node >=22.18; this machine is 22.17.0 + engine-strict
@stellar/stellar-sdk  14.6.1
@stellar/stellar-base 14.1.0
buffer                6.0.3
next 15.5.6 · react/react-dom 19.2.0 · tailwindcss + @tailwindcss/postcss 4.1.16
gsap 3.13.0 · @gsap/react 2.1.2 · lenis 1.3.11 · typescript ^5.9.3 · vitest ^2 · tsup ^8
walletWasmHash: ecd990f0b45ca6817149b6175f79b32efb442f35731985a084131e8265c4cd90
```

## 5. How to run things

```bash
pnpm install                      # from repo root; workspace globs are packages/* and apps/*

pnpm build:contract               # stellar contract build
pnpm test:contract                # cargo test (19 tests)

pnpm --filter probatum-web dev    # Probatum landing → http://localhost:3000
pnpm --filter candela-web dev     # Candela dev page → http://localhost:3001
pnpm --filter candela-web test    # 7 unit tests
pnpm --filter candela-web build   # ⚠️ STOP the dev server first (see §6)

pnpm --filter candela-kit test    # 7 unit tests
pnpm --filter candela-kit build   # tsup → dist/
pnpm --filter candela-kit e2e     # live-testnet Playwright regression (needs funded sponsor .env)

pnpm spike / pnpm spike:test      # frozen Plan-1 spike (reference only)
```

---

## 6. Law-level traps — violating these costs hours

These were all learned the hard way. They are not style preferences.

1. **stellar-base import trap.** Import `Keypair`/`TransactionBuilder` from **`@stellar/stellar-base`**, NEVER from `@stellar/stellar-sdk/minimal`. The `/minimal` browser entry bundles its own stellar-base/js-xdr; mixing copies gives `XDR Write Error: <n> is not a O`.
2. **Re-simulate after signing.** After `kit.sign(...)`, you MUST re-simulate in enforcing mode and `assembleTransaction(built, sim)` before submitting. The recording simulation does not price the wallet's secp256r1 `__check_auth`. (Launchtube hides this by re-simulating server-side; the fallback path does not.)
3. **`kit.sign()` reads `this.wallet`,** which is only set by `createWallet`/`connectWallet` **on the same PasskeyKit instance**. A fresh instance per call throws `TypeError`. `candela-kit` solves this with a module-level `kitCache` (keyed `rpcUrl|passphrase|wasmHash`) + hydration via `connectWallet({ keyId })`, and re-hydrates on identity mismatch (`kit.wallet.options.contractId !== wallet.contractId`). **Do not "simplify" this away** — a reviewer caught exactly this bug pre-ship.
4. **`connectWallet({ keyId })` skips the WebAuthn prompt** (it's gated `if (!keyId)`). That's how hydration works without re-prompting.
5. **passkey-kit constructor takes `walletWasmHash`, not `factoryContractId`** — the README is stale; read `node_modules/.../passkey-kit/src/kit.ts`.
6. **Launchtube is DNS-unreachable from this network** (`testnet.launchtube.xyz` and apex both fail). The **local sponsor fallback is the proven path** and the frozen regression. Known gap: `signAndSubmit` currently ignores `cfg.launchtube` (fallback-only) — route through `send()` when a reachable relay exists.
7. **`server-only` + Vitest.** `server-only` is **not an installed package** in this repo (it lives inside Next's compiled internals), and Vite resolves specifiers eagerly at transform, *before* `vi.mock` applies — so `vi.mock("server-only")` does NOT work. Fix pattern (already in `apps/candela/vitest.config.ts`): `resolve.alias` mapping `server-only` → a local empty stub (`apps/candela/test/stubs/server-only.ts`). **Copy this pattern** for any new app that unit-tests a `server-only` module.
8. **Never run `next build` while that app's dev server is running** — both write to `.next` and the build clobbers the dev manifests, producing `TypeError: Cannot read properties of undefined (reading 'call')`. Recovery: stop server, delete `.next`, restart.
9. **Windows orphan processes.** Killing `pnpm dev` can orphan the `node` child still holding the port. Check `Get-NetTCPConnection -LocalPort 3000` (or 3001) and kill the owning PID.
10. **PowerShell 5.1 gotchas.** Native-exe failures don't throw → guard with `$LASTEXITCODE`. `2>&1` under `$ErrorActionPreference="Stop"` wraps stderr as terminating errors even on success (git/pnpm push output looks like failure — it isn't). `Out-File -Encoding utf8` writes a BOM → use `[System.IO.File]::WriteAllText` with `UTF8Encoding($false)`.
11. **stellar CLI not on PATH** in shells started before its install → `$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')`.

---

## 7. Non-negotiable constraints

### Regulatory (India) — the "no regulatory BS" requirement, by construction
- **No fiat / INR anywhere. No custody. No purchasable or transferable tokens.** This is what keeps us clear of VDA s.2(47A), the 30% / 1% TDS regime, and FIU-IND VASP registration.
- **On-chain: hashes + addresses only. No PII** (DPDP Act). **No Aadhaar** integration (AUA/KUA licensing).
- The passkey wallet holds no purchasable asset. `claim` binds a certificate leaf to a wallet — it mints nothing tradeable.
- Marketing copy must not imply any of the above. Keep it honest.

### Security
- **Secrets never get committed.** The sponsor secret lives only in a gitignored `.env`. Never in code, reports, or commit messages. (`SIM_SOURCE` in the `chain.ts` files is a *public* funded testnet account used as a read-only simulation source — that is fine, it is not a secret.)
- **`deployments/testnet.json` is the single source of truth.** Never hardcode a contract id in a component.
- **`npm publish` of `candela-kit` is GATED** on explicit user go. Prepare, build, `npm pack --dry-run` — but never publish without being told.

### Design
- The look is a **monochrome "Cryptgen-clone"** system: true black (`--color-vault: #000000`), silver/graphite metallic pills, glass cards, gradient-masked `.fade-title` headlines, an arc-glow planet finale. Colour survives **only** in the small red wax logo mark and functional verification-state badges.
- **Fonts: Inter + Fragment Mono ONLY.** The user instantly clocks "AI slop" fonts (Fraunces, Space Grotesk et al.) — do not introduce any new typeface. Inter here is deliberate: it's the cloned template's design font.
- Tokens live in each app's `src/app/globals.css` `@theme` block. **The duplication between `apps/probatum` and `apps/candela` is deliberate** (two apps, two domains — YAGNI on a shared-ui package). Don't "fix" it unless a third consumer appears.
- Every animation degrades under `prefers-reduced-motion: reduce` to a static, complete final frame.
- Gradient banding: never animate grain; SVG noise data-URIs need explicit `width`/`height` or they stretch instead of tile (reads as "moving pixels" — the user will notice).

---

## 8. The contract (v2) — interface and gotchas

`contracts/probatum/src/lib.rs`. Live at `CDB6674Z…R3YV`. Admin `GAT3GZE2…RFBY`.

Entry points: `__constructor(admin)` · `version() -> 2` · `pause(paused) -> Result` · `is_paused()` · `register_issuer` · `update_issuer` · `get_issuer` · `anchor_batch` · `get_batch` · `batch_count` · `revoke_batch` · `revoke_leaf` · `is_batch_revoked` · `is_leaf_revoked` · `claim` · `claim_of` · `claim_count` · `bump_batch` (auth-free, anyone can keep proofs alive).

Rules:
- **`__constructor` is the sole Admin write site** — atomic deploy+init killed the v1 front-running hole. `AlreadyInitialized = 1` is **reserved**; the `Error` enum is **append-only** (discriminants are ABI).
- Events are typed `#[contractevent]`: `IssuerRegistered` / `BatchAnchored` / `BatchRevoked` / `LeafRevoked` / `CertClaimed` / `PauseToggled`.
- `claim` guard order (keep it): paused → auth → exists → batch-revoked → leaf-revoked → already-claimed → proof.
- TTL: `TTL_THRESHOLD = 1_500_000`, `TTL_EXTEND_TO = 3_000_000`; `bump_persistent(env, key)` runs after all persistent `.set` sites.
- **Merkle**: sorted-pair `sha256(min || max)`. Known-answer root `57c49ece895537b2bf5dfe5ba421bbf7666f12a00d28a81c29ba0faa52cd1902` pins the layout — a KAT test enforces it. **Any TypeScript port MUST use unsigned lexicographic compare + `min||max` concat** or proofs won't verify.

### 🔴 Known time bomb (highest-priority pre-mainnet item)
`batch_count`, `claim_count`, `Admin` and `Paused` live in **instance storage, whose TTL is never extended**. Instance entries archive on their own ~120-day clock independent of persistent entries. **The contract will silently archive ~120 days after deploy.** Fix this in the next contract rev.

---

## 9. What's next — the actual work queue

The approved spec is `docs/superpowers/specs/2026-07-12-candela-page-and-viral-loop-design.md`. **Track 1 (Candela dev page) is DONE.** Tracks 2 and 3 are next and should be **one plan, one redeploy**:

### Track 2 — contract rev (ONE consolidated testnet redeploy, `version()` → 3)
Do all of these in a single rev so the contract stops churning:
1. **Instance-storage TTL extension** (the §8 time bomb) — highest priority.
2. **`claim` bumps its parent Batch key** — a batch being claimed is worth keeping alive.
3. **`PauseToggled` `#[topic]` decision** — is `paused` a topic or a data field?
4. **`revoke_leaf` key hoist** — it currently deserializes the full `Batch` for the auth check.
Then: redeploy via the constructor path, update `deployments/testnet.json`, re-seed the genesis batch with the **same KAT root** so the landing pages' displayed proof stays valid. All 19 existing tests must stay green; add tests for TTL extension, claim→Batch bump, pause topic.

### Track 3 — Probatum viral loop (verify + claim + share), on candela-kit
- **Verify** (public, no login): `/verify/[id]` + QR target. Recompute the leaf, check against the on-chain root + revocation state, render **VALID / REVOKED / TAMPERED** in ~1s. Works even if issuer/we vanish. Reuse the `VerifyStack` visual language. Open Graph on the verify page reflects state.
- **Claim** (the passkey magic): recipient claims their certificate into a passkey smart wallet via candela-kit (`SignUpButton`/`useSubmit` → contract `claim` with merkle proof). This also live-proves the kit's sign-in + reload-hydration paths.
- **Share**: one-click LinkedIn card with the verify link baked in — every share is an ad that proves itself.

**Out of scope until later:** the issuer CSV → merkle → anchor pipeline (the "Issue" flow — we lean on the seeded genesis batch so verify/claim are real without it), and mainnet.

### Hardening to fold into Track 3's early tasks (from the Plan 2 review)
live-prove `connectWallet` + reload hydration · type the `assembled` boundary (`{ built: Transaction }`) · make `useSubmit`'s "signing" phase observable · pause-gating tests for anchor/claim/revoke · `transpilePackages: ["candela-kit"]` in the consuming Next app · `CandelaProvider` network-prop identity (use a string preset) · post-hydration identity assertion.

### Other open threads
- **Deploy**: user is buying a domain (leaning `candela.dev` + `probatum.app`). On purchase: update `metadataBase` in both apps' `layout.tsx` and the Hero/UseCase `https://probatum.app` links, then deploy (Vercel fits Next).
- **Before the gated npm publish**: add `packages/candela-kit/README.md` (it's in `files` but doesn't exist — npm page renders blank), verify the `candela-kit` name is free (fallback scope `@candela/kit`), decide whether to ship `dist/*.map`.
- **Pre-mainnet**: leaf↔recipient binding threat model (no binding today — mitigate via confidential link delivery); merkle domain separation / depth bound; upgradeability decision; CI sponsor-key strategy.

---

## 10. Deferred minor issues (logged, none blocking)

- `apps/candela/src/lib/__tests__/chain.test.ts` — a now-redundant `vi.mock("server-only")` with a stale comment. The **`resolve.alias` is the real fix**; repoint the comment so nobody deletes the alias thinking the mock covers it.
- `CopyButton.tsx` — `setTimeout(1600)` has no `clearTimeout` cleanup (inert today: only ever mounted in always-present nav/hero/finale). Clipboard failure is silently swallowed with no fallback.
- `Terminal.tsx` — reduced-motion is read in a post-mount effect, so first paint briefly (~80ms, measured — imperceptible) shows an empty terminal. No `matchMedia` change-listener for a live OS toggle.
- `HowItWorks.tsx` — one mono code line uses `text-[11px] text-parchment` vs the sibling bento idiom `text-[10px] text-ash`.
- `UseCase` renders the live "sponsored actions" number, currently **`0`** (`claim_count` is 0 — nobody has claimed yet). Honest, but revisit the metric once the claim flow lands.
- Dead CSS ships (`.flame-text`, `.aurora*`, `.orbit*`) — accepted cost of the deliberate verbatim token copy. Unused `@gsap/react` dep in `apps/candela`. `WhyItMatters` uses `py-24` vs siblings' `py-28 md:py-36`. In-page anchors aren't Lenis-smooth. `toLocaleString("en-IN")` grouping on a globally-targeted page.

---

## 11. How to work here (conventions that matter)

- **TDD where there is logic.** Write the failing test, see it fail *for the right reason*, then implement. Presentational components have no unit tests — verify them by rendering + `next build`. **Never fabricate a test** to have one.
- **Keep logic pure and testable.** `Terminal.tsx` is the model: all script/frame logic lives in a pure `terminal-script.ts` (unit-tested without timers or RTL); the component is a thin shell.
- **Verify before claiming done.** Run the command, read the output, then say it passes. Evidence before assertions.
- **Commits**: conventional + scoped, e.g. `feat(candela-web): …`, `fix(candela-web): …`, `chore(candela-kit): …`.
- **Code review earns its keep here.** It caught (a) the `signAndSubmit` crash that would have broken every real signing call, and (b) a flagship code snippet advertising a `CandelaProvider config=` prop that doesn't exist (it's `network=`). On a page whose pitch is "the code is real," snippets must match the kit **exactly** — check `packages/candela-kit/src/react/` before writing any example.
- **Real artifacts only** in UI copy. If you show a wallet/tx/hash, it must be a real one from `deployments/testnet.json` or a proven run.

### About the user
- Solo builder in India. **Does not write code** — "you will be writing everything bro, not me so decide." Make technical calls autonomously and bias toward polished/cool; bring them **direction** decisions only.
- Their client can **miss long content that appears before a tool call** — put deliverables (summaries, questions, options) in the **final message** of a turn.
- They value the "10M ARR product" bar: no AI-slop fonts, no lazy gradients, real proof over mock demos.
