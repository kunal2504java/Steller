# Candela Payments — design spec

Date: 2026-07-17 · Status: **approved by user** (design presented and accepted in session)
Scope owner: candela-kit + unified server (`apps/probatum`). No Soroban contract changes.

---

## 1. Goal

Extend Candela from onboarding-only to **onboarding + payments**, so the pitch becomes:
*anyone building anything on Stellar can sit worry-free about onboarding and payments if
they have Candela.* A payment is passkey-signed (no seed phrase) and sponsored (no gas),
exactly like every other Candela action.

Strategic context (researched 2026-07-17): SCF's 2025–26 winners skew toward stablecoin
payment corridors and USDC settlement (~19.5K wallets transacting stablecoins daily on
Stellar); SDF now positions passkey smart wallets as the payments UX and has adopted the
x402 agentic-payments standard. Payments is the single highest-leverage capability to add
to a passkey kit targeting the Passkey UI RFP.

## 2. Decision summary

| Decision | Choice |
|---|---|
| Mechanism | **Direct SAC `transfer` through the passkey smart wallet.** Every Stellar asset (XLM included) has a protocol-defined Stellar Asset Contract; a payment is `transfer(from=wallet, to, amount)` signed by the passkey and submitted through the existing sponsor path. No new contract, no redeploy. |
| Scope (user-approved "full ladder") | Kit core API → React hooks + `<PayButton>` → payment links + QR demo on the unified site + landing-page Payments section. |
| Asset model | Asset-generic by construction: `asset` parameter is any SAC address; defaults to the network's **native XLM SAC derived from the network passphrase** (never hardcoded). Mainnet USDC works day one by passing its SAC address — no code change. |
| Payment requests | **Stateless links**: the URL encodes the request; no database, nothing stored, nothing operated. |
| Demo network | **Testnet only** (valueless tokens) — keeps the regulatory posture airtight. |
| Rejected | Custom payments-router contract (new audit surface days before deadline; makes us look like payment infrastructure operators — worse regulatory posture; YAGNI). Classic payment ops (require a G-account sender; our wallets are C-addresses). |

## 3. Kit core API (`packages/candela-kit/src/core/pay.ts`)

### 3.1 `pay(cfg, wallet, request, options?) → { hash, status }`

```ts
type PayRequest = {
  to: string;          // G... or C... recipient
  amount: string;      // decimal string, e.g. "25" or "0.5" — never a float
  asset?: string;      // SAC contract address; default = native XLM SAC for cfg's network
  memo?: string;       // display-level only in v1 (see 3.4)
};
```

Builds the SAC `transfer(from: wallet.contractId, to, amount)` invocation as a
`BuiltAssembledTransaction` and delegates to the **existing, live-proven `signAndSubmit`**:
passkey signature → enforcing re-simulation (trap: `__check_auth` pricing) → same-origin
sponsored submission (`cfg.submissionUrl`) or local sponsor fallback. `options` mirrors
`SignAndSubmitOptions` (`onSigned` etc.) so `usePay` can expose observable phases.

**Transaction source**: sponsored builds use a public source account. `CandelaConfig` gains
optional **`sourceAccount`** (a *public* G address, the sponsor's account — public info, not
a secret). The unified app passes `deployment.adminPublic`. Reads use the existing
SIM-source pattern.

**SAC client construction** (implementation choice for the plan's first task — spike, then
pick): (a) `contract.Client` from `@stellar/stellar-sdk/minimal/contract` with an embedded
hand-authored Spec for the tiny protocol-defined SAC surface we use (`transfer`, `balance`,
`decimals`), or (b) kalepail's `sac-sdk` if compatible with pinned stellar-sdk 14.6.1.
Either way the output must be the same `BuiltAssembledTransaction` shape `signAndSubmit`
already accepts, and the choice is proven by landing a real transfer on testnet.

### 3.2 `getBalance(cfg, account, asset?) → { raw: bigint, formatted: string, decimals: number }`

Read-only SAC `balance(id)` via simulation (same pattern as the landing's chain reader —
free, no auth, no fee). `account` may be G or C address.

### 3.3 Amount math — pure, no floats

`parseAmount(decimal: string, decimals: number) → bigint` and
`formatAmount(raw: bigint, decimals: number) → string`. i128-range aware; rejects negative,
empty, malformed, and more fractional digits than the asset's `decimals`. Asset decimals
resolved via SAC `decimals()` (7 for XLM), cached per (network, asset).

### 3.4 Payment links — pure codec

- `encodePayRequest(req: PayRequest) → string` — base64url of canonical JSON.
- `decodePayRequest(code: string) → PayRequest` — validates addresses/amount shape; throws
  on tamper or junk.
- `toSep7(req) → string` — bonus interop helper emitting the standards-track
  `web+stellar:pay?destination=…&amount=…` URI (pure string builder, unit-tested).

`memo` in v1 is **display-only** (link, payer page, OG image). It is NOT written on-chain —
SAC `transfer` has no memo argument and we do not over-promise. Revisit if a real need
appears.

## 4. Kit React API (`packages/candela-kit/src/react/`)

- **`usePay()` → `{ pay, state, error, hash }`** with phases
  `idle → building → signing → submitting → confirmed | failed` — same observable-state
  design language as `useSubmit`.
- **`useBalance(account?, asset?)` → `{ balance, loading, refresh }`** — `account` defaults
  to the connected wallet from context; manual `refresh()` (the demo calls it on
  confirmation so the balance visibly moves).
- **`<PayButton to amount asset? memo? onPaid? className? children?>`** — drop-in; uses the
  connected wallet from `CandelaProvider` context; busy/disabled/error idioms copied from
  `SignUpButton` (`data-candela` attributes, `role="alert"` error span).

The whole pitch in three lines (snippets MUST match the kit exactly — check
`src/react/` before writing any example; prop is `network`, not `config`):

```tsx
<CandelaProvider network="testnet">
  <SignUpButton />                     {/* onboarding: solved */}
  <PayButton to="G…" amount="25" />    {/* payments: solved  */}
</CandelaProvider>
```

## 5. Server changes (`apps/probatum`)

### 5.1 Sponsor guard: third allowlist kind `"pay"`

`validateSubmission` currently accepts exactly two shapes (wallet-deploy, claim), deny by
default. Add `isPay`, mirroring `isClaim`'s strictness:

- source account == `deployment.adminPublic`; transaction unsigned by source (server signs
  after validation); exactly one op; fee ≤ existing `MAX_INNER_FEE`.
- op is `invokeHostFunction` → `hostFunctionTypeInvokeContract` on the **native XLM SAC
  address only** (derived server-side from the network passphrase), function `transfer`,
  exactly 3 args.
- exactly one auth entry, `sorobanCredentialsAddress`, whose address == the `from` argument;
  root invocation pinned to that same SAC + `transfer`.
- deny-by-default preserved; every rejection path unit-tested.

### 5.2 Demo faucet: `POST /api/candela/fund`

New wallets hold zero XLM and cannot demo a payment. The faucet lets the sponsor seed a
freshly created wallet with a small fixed amount of test XLM (sponsor G → wallet C via SAC
transfer, classic source auth). Guards: same-origin (reuse the submit handler's origin
checks), valid C-address, **fund only when the wallet's XLM balance is below a threshold**
(re-fund abuse impossible without first spending), fixed amount (e.g. 10 XLM), best-effort
in-memory rate limit per IP, testnet-only by construction. Not part of candela-kit's public
API — it is demo infrastructure.

## 6. Demo UX (unified server; Candela design system verbatim)

- **`/pay`** — Candela Pay playground: create/connect passkey wallet · live balance ·
  "request money" form (amount + optional memo → shareable link + 240px monochrome QR,
  reusing Probatum's encoder) · prefilled **"tip the builder"** demo request paying a real
  recorded testnet wallet from `deployments/testnet.json` (real artifacts only).
- **`/pay/[code]`** — payer page: decode + validate the request → request card (recipient,
  amount, memo) → *Pay with passkey* → fingerprint → confirmed state with tx hash linked to
  stellar.expert and balance refreshed. Invalid/tampered codes render a clear error state.
  Dynamic OG tags (reuse the verify-page OG pattern) so shared links unfurl.
- **Landing `/`** — new **Payments section** after How-it-works: the 3-line snippet,
  "Onboarding and payments. Both solved." copy, CTA into `/pay`. Nav pill gains a link (plan
  decides exact label/placement).
- Design constraints as law: monochrome tokens, Inter + Fragment Mono only, `data-reveal`,
  every animation degrades to a complete static frame under `prefers-reduced-motion`,
  no horizontal scroll at 375px. **Tailwind source-boundary trap applies** (AGENTS.md §6.12):
  any new Candela-side component rendered by `apps/probatum` must have its layout-critical
  classes represented in `apps/probatum`'s CSS sources; verify computed styles against the
  unified production build.

## 7. Regulatory posture (unchanged, by construction)

Kit remains neutral non-custodial OSS — we never hold funds; the sponsor pays **fees** only
(and, on testnet, seeds valueless demo tokens). Demo strictly testnet. No fiat, no INR, no
ramps, no PII, no Aadhaar. Copy gets the standing honesty review: no custody or investment
implications, token mentions stay functional.

## 8. Testing

- **Pure units**: amount math (i128 edges, fractional-digit rejection, negatives, junk),
  link codec roundtrip + tamper cases, SEP-7 builder.
- **React render tests**: `usePay` state machine with mocked core; `PayButton`
  busy/disabled/error surfaces.
- **Sponsor guard**: accepts a valid SAC transfer; rejects wrong contract, wrong function,
  auth/from mismatch, multi-op, over-cap fee, signed-by-source. Faucet: threshold gate,
  address validation, origin guard.
- **Live e2e (extends the existing Playwright regression)**: create wallet → faucet →
  pay the demo request → Horizon `successful=true` + balance delta shown in UI.
- All existing suites stay green (Rust 25 untouched — no contract change); both production
  builds; typecheck.

## 9. Acceptance criteria

1. A consuming Next app renders `SignUpButton` + `PayButton` and a real sponsored XLM
   transfer lands on testnet, signed by a passkey — proven live, recorded (tx hash) in the
   ledger, no secrets printed or committed.
2. `/pay` and `/pay/[code]` work end-to-end in the unified production build at 1440px and
   375px, zero console errors, reduced-motion complete frames.
3. Payment links survive copy/paste cold-load (stateless); tampered links fail loudly.
4. Sponsor endpoint still rejects everything outside the three allowlisted shapes.
5. Landing Payments section live with a truthful snippet that compiles against the kit's
   real API.
6. npm publish remains **gated** — kit version stays unpublished until explicit user go.

## 10. Out of scope (named, deliberate)

x402 agentic payments (phase 2 — `pay()`/links make it a natural extension), fiat ramps /
SEP-24 / SEP-31, recurring payments, mainnet deployment, mainnet USDC demo (API-ready via
`asset`), payment-history UI, on-chain memo.

## 11. Notes for the implementation plan

- Spike-first task: SAC client construction choice (§3.1) proven by a real testnet transfer
  before any React work builds on it.
- `CandelaConfig.sourceAccount` addition is public info; keep `resolveConfig` presets tidy.
- Native SAC derivation: `Asset.native().contractId(passphrase)` from `@stellar/stellar-base`
  (mind trap #1: never import from `@stellar/stellar-sdk/minimal` for this).
- Faucet + guard both derive the native SAC server-side; never trust the client's asset
  claim for sponsorship decisions.
- Reuse `waitForTx`/polling idioms already in `wallet.ts`; no new submission machinery.
- Kit README (pre-publish, still gated) should gain the 3-line payments snippet when it is
  eventually written.
