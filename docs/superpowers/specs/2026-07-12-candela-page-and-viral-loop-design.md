# Design — Candela dev page + Probatum viral loop (Plan 3)

Date: 2026-07-12
Status: approved (design gate)
Supersedes nothing; extends `2026-07-03-candela-probatum-design.md` (product/architecture spec) and follows Plan 2 (contract v2 + candela-kit, merged to `main` at `cfa6c17`).

## 1. Goal

Two products now have a kit and a contract proven on testnet, plus a finished Probatum landing page. What's missing is (a) a **developer front door for Candela** — the open-source product that targets SCF's active Passkey-UI RFP — and (b) a **working Probatum viral loop** a judge can actually click. This design covers both, plus the single consolidated contract redeploy that clears the pre-mainnet ledger.

Framing: **Candela is the product; Probatum is its flagship use case.** The Candela page sells the kit to developers ("Web3 UX should not suck"); Probatum proves it with a real, live thing.

## 2. Scope & sequencing

Three tracks, built in this order (approved option A — Candela-first):

1. **Track 1 — Candela dev page** (`apps/candela`). Pure frontend, zero contract dependency, ships fastest, strategically primary. Forces us to finalize the kit's public install/API surface.
2. **Track 2 — Contract rev** (one consolidated testnet redeploy). Clears every pre-mainnet finding at once so the contract never churns again.
3. **Track 3 — Probatum viral loop** (verify + claim + share), built on candela-kit against the revved contract.

**Out of scope for Plan 3** (deferred to a later plan): the full issuer CSV → merkle → anchor pipeline (the "Issue" flow). We already have a seeded genesis batch on-chain, so verify/claim/share can be real without building issuer tooling first. Mainnet launch is also out of scope (test net only in Plan 3).

## 3. Regulatory constraints (persist — non-negotiable)

Unchanged from the product spec and re-asserted here because Plan 3 adds user-facing flows:
- No fiat / INR anywhere; no custody; no purchasable or transferable tokens (avoids VDA s.2(47A), 30%/1% TDS, FIU-IND VASP registration).
- On-chain: hashes + addresses only. No PII on-chain (DPDP). No Aadhaar / AUA-KUA integration.
- The passkey wallet holds no purchasable asset; "claim" binds a certificate leaf to a wallet, it does not mint anything tradeable.

## 4. Track 1 — Candela dev page (`apps/candela`)

### 4.1 Architecture
- New Next.js app `apps/candela` (App Router, React 19, Tailwind v4), matching `apps/probatum`'s toolchain and config (including `outputFileTracingRoot`, Lenis+GSAP one-clock setup, static grain).
- **Design system reuse.** The monochrome Cryptgen tokens + primitives (`globals.css` `@theme` block, `.fade-title`, `.pill-metal`, `.pill-ghost`, `.glass-card`, `.grid-bg`, `.arc-glow`/`.arc-rim`, `.eyebrow`, `.grain`, wax-dot mark, Inter + Fragment Mono) are copied into `apps/candela` verbatim as the starting point. Rationale: two apps, two domains — duplicating ~200 lines of design tokens is cheaper and less coupled than a premature shared-ui package. If a third consumer appears, extract then (YAGNI).
- Live data: the page reads the same `deployments/testnet.json` single source of truth for any real on-chain artifacts it displays (contract id, genesis tx), via a `chain.ts` mirroring Probatum's — fails soft to "—".

### 4.2 Sections (top → bottom)
1. **Nav pill** — floating, wax dot + "Candela"; links How it works · Docs · GitHub; right-side `pill-metal` "Get started".
2. **Hero** — headline = the thesis **"Web3 UX should not suck."** Sub: passkey onboarding for Stellar — no seed phrase, no browser extension, no gas. Primary CTA `pill-metal` is a **click-to-copy** `npm i candela-kit`; secondary ghost "See it live →" links to the Probatum demo.
3. **Terminal animation (centerpiece).** A faux-terminal `glass-card` that runs a scripted sequence:
   - types `pnpm add candela-kit` → `✓ added candela-kit`
   - flips to a code pane with the **real** minimal usage: wrap in `<CandelaProvider config="testnet">`, drop a `<SignUpButton>`, call `useSubmit()` to sign+submit.
   - ends on a result line drawn from real testnet artifacts: `passkey created → smart wallet CD67… → sponsored tx ✓`.
   - Implementation: client component, JS-driven typing with a deterministic script (no `Math.random`); `prefers-reduced-motion` renders the final frame statically (no typing). No real network calls — it's an illustrative reenactment of the proven flow, using real API names and real artifact strings.
4. **How it works** — three honest steps with real (compiling-shape) snippets: (a) passkey → secp256r1 smart wallet; (b) you sponsor fees via Launchtube so the user pays nothing; (c) one hook signs + submits. Copy stays truthful to the kit's actual behavior.
5. **Built with Candela → Probatum** — flagship use-case block. Sells Probatum (certificates that can't be faked), pulls its live stats from chain, links to the Probatum landing and the live contract on stellar.expert. Message: "One kit, real products."
6. **Why it matters** — open source, TypeScript, React, live on Stellar today; nods to the published RFP demand (passkey UX is the piece Web3 keeps getting wrong).
7. **Arc finale + footer** — same planet-arc finale; repeat `npm i candela-kit` (click-to-copy), GitHub, docs links.

### 4.3 npm publish decision
`candela-kit` is currently `private: true`, unpublished. For a developer tool the install command must be **real**. Plan: prepare the package for publish (drop `private`, set `license: MIT`, `files`/`exports`/build so `pnpm add candela-kit` resolves a real entry), and **publish to npm as a gated final step**. The npm publish itself is outward-facing and hard to fully reverse, so it happens **only on explicit user go** — the entire page is built and verified with the command shown but publish deferred until the green light. If the name `candela-kit` is taken on npm, fall back to a scope (`@candela/kit` or similar) and reflect it on the page.

### 4.4 Testing
- Component/render smoke via the app's existing lint/build gate.
- Terminal animation: a unit test asserting the reduced-motion path renders the final frame (no reliance on timers), and that the script is deterministic.
- Manual verify pass (the `/verify`-style checklist): page renders at 200, copy-to-clipboard works, links resolve, reduced-motion honored, mobile layout holds.

## 5. Track 2 — Contract rev (one consolidated redeploy)

Consolidate every pre-mainnet finding from the Plan 1/2 reviews into a **single** testnet redeploy (`version()` → 3), so the contract stops churning:
- **Instance-storage TTL time bomb** — the contract's instance entry (admin, counters) archives on its own ~120-day clock independent of persistent entries; add instance-TTL extension so admin/counters don't silently archive. This is the highest-priority item.
- **`claim` bumps the Batch key** — claiming a leaf should extend the parent Batch's TTL (a batch actively being claimed is a batch worth keeping alive).
- **`PauseToggled` topic indexing** — decide and apply whether `paused` is a topic vs data field on the event.
- **`revoke_leaf` hoist** — lift/confirm leaf-revocation is a first-class guarded entrypoint consistent with the claim guard order.
- Append-only Error enum and event discipline preserved; all existing tests stay green; new tests cover TTL extension, claim→Batch bump, and pause topic.
- Redeploy via the existing constructor path; update `deployments/testnet.json` (contractId, wasmHash, deployedAt, genesisTx) as the single source of truth; re-seed the genesis batch with the same KAT root so the landing pages' displayed proof stays valid.

## 6. Track 3 — Probatum viral loop (verify + claim + share)

Built on candela-kit, against the revved contract. Three flows:

- **Verify (public, no login).** A `/verify/[id]` route (and QR target) that takes a certificate reference, recomputes the leaf, checks it against the on-chain batch root + revocation state, and renders one of three states: **VALID / REVOKED / TAMPERED** in ~1s. Zero auth, works even if issuer/we disappear. Reuses the `VerifyStack` visual language.
- **Claim (passkey magic × virality).** Recipient claims their certificate into a passkey smart wallet via candela-kit (`SignUpButton`/`useSubmit` → the contract's `claim` with merkle proof). Live-proves the kit's sign-in + reload-hydration path (a Plan-2 forward finding). Produces a shareable proof.
- **Share.** One-click LinkedIn share card with the verify link baked in — "every share is an ad that proves itself." Open Graph on the verify page renders the state.

Hardening items pulled forward from the Plan-2 final review (apply as early tasks): live-prove `connectWallet` + reload hydration; type the `assembled` boundary; make the "signing" phase observable; pause-gating tests; `transpilePackages: ["candela-kit"]` in the consuming app; provider network-prop identity; post-hydration identity assertion.

### 6.1 Testing
- Contract-level tests for claim + proof + revocation (Rust, in the contract suite).
- Verify flow: unit tests for leaf recompute + state resolution against fixture roots (incl. the KAT root); the three states each covered.
- Claim flow: live testnet e2e through candela-kit's public API (Playwright virtual authenticator), mirroring Plan 2's T7 — creates a wallet and lands a real `claim` on testnet, asserted on-chain.

## 7. Success criteria

- `apps/candela` renders a polished, on-brand dev page with a working terminal animation and click-to-copy install; links to the live Probatum demo and on-chain proof.
- `candela-kit` is publish-ready (publish itself gated on user go).
- Contract rev deployed to testnet, `deployments/testnet.json` updated, genesis proof still valid, all contract tests green.
- Probatum verify works publicly for VALID/REVOKED/TAMPERED; claim lands a real testnet tx through the kit; share produces a verify-linked card.
- No regulatory red lines crossed (§3); no secrets committed (sponsor secret stays in gitignored `.env`).

## 8. Risks / open decisions

- **npm name availability** — `candela-kit` may be taken; fall back to a scope. Resolved at publish time.
- **Contract rev is a breaking redeploy** — new contractId; the landing pages, kit playground bindings, and app all repoint via `deployments/testnet.json`. One coordinated bump.
- **Leaf ↔ recipient binding** threat model for claim (a Plan-2 forward finding) — must be settled in the Track-3 tasks before claim is called "done".
- **Launchtube reachability** — testnet relay was DNS-unreachable during Plan 1; the fallback simulate+assemble+submit path is proven and is the default. Launchtube stays best-effort.
