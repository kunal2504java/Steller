# Candela + Probatum — Design Spec

**Date:** 2026-07-03
**Author:** Kunal (product) + Claude (design/engineering)
**Status:** Approved direction; pending final spec review
**Target:** Stellar Build Station (Rise In + SDF, India) — 21-day sprint format; ~2-week build window. Pipeline beyond: Instaward (up to $15K) → SCF Build Award (RFP track relevant — "Passkey UI").

---

## 1. One-liner

> **Probatum** — certificates that can't be faked, sealed on Stellar mainnet forever, for the 99% of Indian issuers DigiLocker forgot. Built on **Candela** — the open-source kit that makes Stellar invisible: your fingerprint is your wallet.

One monorepo, two deliverables. Candela is the fundable infrastructure (targets SCF's active Passkey UI RFP). Probatum is the live consumer proof with a built-in viral loop. Each makes the other credible.

## 2. Goals & success criteria

By demo day:
1. Candela published to npm (`candela-kit`), MIT-licensed, docs site live with a working playground and a device/browser compatibility matrix.
2. Probatum live on **Stellar mainnet**: real issuers, real certificates, live on-chain counters. Target: 3+ real issuers, 500+ certificates sealed, 100+ recipient claims.
3. At least one other Build Station team using or committed to using Candela.
4. Demo: room onboards via fingerprint; judges watch mainnet counters tick; flip to candela.dev to show the six lines of code behind it.

## 3. Hard constraints

- **Zero India regulatory surface:** no fiat, no payments, no custody of user funds, no purchasable or transferable value tokens. On-chain content is hashes + attestations only (no VDA under s.2(47A), no FIU-IND VASP triggers). No PII on-chain (DPDP: chain data can't be erased, so only merkle roots and pseudonymous wallet addresses go on-chain). No Aadhaar integration (AUA/KUA licensing) — issuer identity binds to domains/socials instead.
- **Mainnet deployment** (Build Award final-tranche criterion; also our credibility play).
- **Chain must be load-bearing** (SCF rejects "mere data storage"): on-chain issuer registry, revocation as state transitions, recipient claims, verification that outlives both issuer and platform.
- **Contracts open-sourced** (SCF requirement).
- Solo founder + AI-written code; 14 days; Windows dev environment.

## 4. Deliverable 1 — Candela (`candela-kit`)

React + TypeScript layer over `passkey-kit` (smart wallets via passkeys / secp256r1) and Launchtube (fee-sponsored submission).

### 4.1 Public API (MVP)

- `<CandelaProvider network cfg>` — context: network, Launchtube credentials or fallback sponsor config, app metadata, theme.
- `<SignUpButton onWallet>` / `<SignInButton onWallet>` — full flow: passkey create/get → smart wallet deploy/connect → session persisted (localStorage: passkey id + wallet address). Polished modal UI (loading, success, error states).
- `useWallet()` — `{ address, isConnected, disconnect }`.
- `useSubmit()` — `submit(op | tx) → { status: idle|signing|submitting|confirmed|failed, txHash, error }`; signs with passkey, submits via Launchtube, falls back to configured fee-bump sponsor account if Launchtube is unavailable.
- `<TxButton>` — button wired to `useSubmit` states (spinner → checkmark → error retry).
- `<WalletBadge>` — truncated address chip with explorer link.
- Capability detection: `canUsePasskeys()` — if unsupported (old browsers, some in-app webviews), components render a graceful explainer with "open in Chrome/Safari" deep-link instead of a broken flow.

### 4.2 Non-goals for MVP

No multi-signer policies, no recovery flows beyond platform passkey sync (iCloud/Google), no non-React bindings, no key export. Documented as roadmap.

### 4.3 Deliverables

npm package, GitHub (MIT), docs site (candela.dev or subpath) with live playground, quickstart, per-component snippet + rendered demo, **compatibility matrix** (Chrome/Android, Safari/iOS, desktop browsers, Telegram/Instagram in-app webviews) backed by a Playwright test suite where automatable + manual test log elsewhere. Brand line: "lumen = candela · steradian — what lumens are made of."

## 5. Deliverable 2 — Probatum

### 5.1 Organizer flow (single-player wedge)

1. Sign up with passkey (Candela — dogfooding).
2. Create issuer profile: name, logo, website domain, socials. Domain verification via DNS TXT or meta-tag check (best-effort MVP); verified badge shown on issuer page. Profile hash registered on-chain.
3. Create a batch: event name, date, certificate title; upload CSV (name, optional email, optional field like rank/role).
4. Pick a template (2–3 polished designs at launch), preview, generate.
5. One click: app computes leaf hashes (canonicalized cert JSON), builds merkle tree, submits `anchor_batch(root, meta)` — signed by the issuer's passkey, fee-sponsored.
6. Distribution: downloadable links CSV, or email delivery (Resend), or a public claim-link mode for events that don't have recipient lists (rate-limited, code-protected).

### 5.2 Recipient flow (the viral surface)

- Personal page `probatum.app/c/{id}`: rendered certificate, animated wax-seal moment, **PROBATUM EST — proven on Stellar mainnet, block #N** with explorer link.
- **Dynamic OG image** (recipient's name on the certificate + seal + "Verified on-chain" ribbon) — the LinkedIn/WhatsApp preview is the growth engine.
- Actions: download PNG/PDF (QR embedded), **Add to LinkedIn** (prefilled certification fields + post), **Claim with fingerprint** — creates recipient wallet via Candela and calls `claim(batch_id, leaf, proof)`, binding the cert to their address. Claiming is optional; certificates verify without it.
- Loop-closer on every cert/verify page: "Running an event? Issue certificates like this — free →".

### 5.3 Verifier flow

`probatum.app/verify` + QR target: paste link or scan → recompute leaf hash from the cert record → merkle proof against on-chain root → show issuer identity (registered profile, domain-verified badge), anchor timestamp/tx, revocation status, claim status. Everything independently checkable via any Stellar RPC; an open-source CLI verifier ships in the repo so verification survives us.

**Honest-copy rule:** Probatum proves *who issued what, when, and that it's unaltered/unrevoked*. It never claims the issuer or content is "legitimate." UI copy and issuer pages must reflect this (anti-credential-laundering: issuer identity binding + verified-domain badges are the mitigation, not promises of legitimacy).

## 6. On-chain design (one Soroban contract, Rust)

```text
register_issuer(issuer: Address, profile_hash: BytesN<32>)
update_issuer(issuer, profile_hash)                    // issuer-only
anchor_batch(issuer, root: BytesN<32>, meta_hash, count: u32) -> batch_id
revoke_batch(issuer, batch_id)                         // issuer-only
revoke_leaf(issuer, batch_id, leaf_index: u32)         // issuer-only
claim(recipient: Address, batch_id, leaf_hash, proof: Vec<BytesN<32>>)
// views: issuer_of(batch), is_revoked(batch, leaf?), claim_of(batch, leaf), stats()
pause()/unpause()                                      // admin key, emergency only (documented centralization point; roadmap: renounce)
```

- Merkle verification for `claim` on-chain; events emitted for every state change (indexable for stats/counters).
- No token, no balances, nothing transferable. Storage costs bounded: one entry per batch + per claim + per revocation (not per certificate).
- Rust unit tests on every path (anchor/revoke/claim/proof failure/auth failure); testnet deploy week 1; identical Wasm to mainnet day 10.

## 7. Off-chain architecture

- **Monorepo (pnpm):** `packages/candela-kit`, `apps/probatum` (Next.js App Router + Tailwind), `apps/candela-docs`, `contracts/probatum` (Rust).
- **Supabase (Postgres):** issuers, batches (cert records: name, title, event, leaf salt), templates, claim links, emails. Certificate records include a per-leaf salt so leaf hashes aren't guessable from public info (privacy: merkle root reveals nothing; cert JSON + salt needed to verify — carried in the cert link/QR payload).
- **Rendering:** cert PNG/PDF + dynamic OG images via `@vercel/og` / satori; QR via `qrcode`.
- **Email:** Resend free tier.
- **Chain access:** Soroban RPC (public endpoints + fallback); Launchtube for submission (mainnet token requested via SDF Discord; fallback: our fee-bump sponsor account holding a few USD of XLM).
- **Hosting:** Vercel. Domains: probatum.app + candela.dev (or available variants — final availability check at purchase; scoped npm fallback `@candela-kit/react` if `candela-kit` is taken).

## 8. Landing pages

**probatum.app (consumer/virality):** hero (3D certificate + wax seal, "Certificates that can't be faked. Sealed on Stellar, forever."), live mainnet counter strip with "audit on-chain →" link, inline 60-second sandbox (name → fingerprint → demo cert sealed live), 3-step how-it-works, fraud-story impact section (~1M fake-certificate raid), event logo wall, footer "Sealed on Stellar · Built on Candela." **The certificate page is treated as the primary landing surface** (OG images, share actions, loop-closer CTA).

**candela.dev (dev/credibility):** split hero — real ~6-line integration code left, that exact code running live right ("Your fingerprint is your wallet", `npm i candela-kit`); physics tagline; live component gallery with copy-paste snippets; compatibility matrix as a feature; Probatum case study with live chain numbers; GitHub/npm badges + quickstart.

**Shared design language:** near-black night sky, candlelight gold, wax-seal crimson accent; Latin-flavored serif display for Probatum, clean sans/mono for Candela; seal motif throughout; both footers: "Proven on Stellar mainnet." (Detailed visual pass at build time via frontend-design.)

## 9. Error handling & edge cases

- Passkey unsupported/blocked (in-app webviews): capability detection → explainer + open-in-browser deep link. Compatibility matrix documents every tested environment.
- Anchor tx fails: batch stays "draft"; retry idempotently (same root); no links distributed until confirmed.
- Launchtube down/quota: automatic fallback to fee-bump sponsor; alert on sponsor balance.
- Lost device: passkeys sync via iCloud/Google password manager; document limits honestly. Issuer key loss MVP fallback: new wallet + re-register profile; old batches remain valid under old address (documented).
- CSV garbage: validation + preview before generation; batch size cap (5,000) for MVP.
- Duplicate/spam issuers: email verification + rate limits; domain verification for the trust badge; abuse reports → platform can delist from *our UI* (on-chain data immutable — delisting is presentation-layer, documented).
- RPC outage: counters/verification degrade to cached with "live check unavailable" state; CLI verifier works against any RPC.

## 10. Testing

- Contract: Rust unit tests (all paths incl. auth + bad proofs); testnet integration rehearsal of full flow.
- Kit: Playwright E2E on the playground (Chrome + virtual authenticator API for passkeys); manual matrix for iOS/Safari/webviews (Windows dev box + real Android + borrowed iPhone).
- App: scripted E2E — create issuer → anchor batch → open cert page → claim → verify; plus revoke path. Run against testnet in CI-lite (GitHub Actions), against mainnet manually before demo.
- Pre-demo drill: full demo run on a phone over mobile data (not conference Wi-Fi).

## 11. 14-day build order

| Days | Work |
|---|---|
| 1–2 | Monorepo scaffold; riskiest-first spike: passkey-kit + Launchtube end-to-end on testnet |
| 3–4 | Candela core: provider, sign-up/in flows, useSubmit, auth modal, capability detection |
| 5 | Soroban contract + unit tests; testnet deploy |
| 6–8 | Probatum flows: issuer onboarding, CSV → generate → anchor; cert page; verify page; claim |
| 9 | Templates, PDF/PNG/QR, OG images, LinkedIn share |
| 10 | Mainnet: deploy contract, first real batch; Launchtube token or sponsor fallback live |
| 11–12 | Both landing pages, docs + playground, compatibility matrix, polish |
| 13 | Traction seeding: real event batch (Rise In cohort / any July event / own network), npm publish, GalacticTalk + Discord posts |
| 14 | Buffer; demo video; Build Station application materials |

**Prereqs from founder:** ~$10 XLM, domains, event-organizer intros for day 13.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Passkey flakiness on budget Androids / webviews | Capability detection + fallback UX; the matrix is a deliverable, so the pain is productized |
| Launchtube mainnet access delayed | Fee-bump sponsor account fallback (built day 1–2) |
| Someone else shipping the Passkey UI RFP | Out-polish + ship the live consumer proof they won't have |
| "Mere data storage" objection | On-chain registry/revocation/claims + issuer-signed state transitions + verification-outlives-us narrative |
| Credential laundering by scam issuers | Identity binding (domain/socials), honest copy, UI delisting |
| Cold start on issuers | Build Station circuit itself issues certificates; founder's network; free + 5-minute pitch |

## 13. Out of scope (documented roadmap)

Multi-signer/recovery policies, non-React bindings, Telegram mini-app distribution, DigiLocker/official-issuer integrations, template marketplace, paid tiers, DAO-ing the pause key, Vouch (shelved second product).
