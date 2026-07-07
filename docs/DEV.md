# Development Environment Setup (Windows)

This document records the toolchain required to build and test the Soroban
contracts in this repo, along with the exact versions verified on this
machine (Windows 11, PowerShell).

## Toolchain versions verified

```powershell
node --version
# v22.17.0

corepack enable; pnpm --version
# 9.15.0

rustup --version
# rustup 1.28.2 (e4f3ad6f8 2025-04-28)
# info: This is the version for the rustup toolchain manager, not the rustc compiler.
# info: The currently active `rustc` version is `rustc 1.91.1 (ed61e7d7e 2025-11-07)`

rustc --version
# rustc 1.91.1 (ed61e7d7e 2025-11-07)

rustup target add wasm32v1-none
# info: downloading component 'rust-std' for 'wasm32v1-none'
# info: installing component 'rust-std' for 'wasm32v1-none'

stellar --version
# stellar 27.0.0 (5a7c5fe76530bf4248477ac812fc757146b98cc4)
# stellar-xdr 27.0.0 (5262803470be965e42f80023d12fba12808c774a)
# xdr (68fa1ac55692f68ad2a2ca549d0a283273554439)
```

All versions meet the required floors (node >= v20, pnpm >= 9, rustc >= 1.85,
stellar >= 23).

## Setup notes

- Node.js, pnpm (via Corepack), rustup, and rustc were already installed and
  met the required floors — no install needed for those.
- `wasm32v1-none` (the Soroban build target) was not installed by default and
  was added with `rustup target add wasm32v1-none`.
- The Stellar CLI was **not** installed. The brief's suggested winget package
  ID (`StellarDevelopmentFoundation.StellarCLI`) does not exist in the
  winget registry. The correct ID, found via `winget search stellar`, is
  **`Stellar.StellarCLI`**. Installed with:
  ```powershell
  winget install --id Stellar.StellarCLI --accept-package-agreements --accept-source-agreements
  ```
  This installed version 27.0.0 to `C:\Program Files (x86)\Stellar CLI` and
  added that directory to the machine `PATH`.
- After installing, `stellar` was not recognized in the current shell
  session, because the session's process had already started before the
  installer updated the registry `PATH` and Windows does not push
  environment changes into already-running processes. **A new terminal
  window (or re-reading the PATH from the registry) picks it up.** To
  refresh without opening a new shell:
  ```powershell
  $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
  ```
  Any genuinely new PowerShell/terminal window opened after the install
  will have `stellar` on `PATH` automatically.

## Building and testing contracts

Contracts build with `pnpm build:contract`; tests with `pnpm test:contract`.

## Passkey + sponsored-submission spike (Task 10)

`packages/spike` proves the passkey → smart-wallet → sponsored `register_issuer`
path against the deployed testnet contract. Full write-up:
`.superpowers/sdd/task-10-report.md`. Run it with:

```powershell
cp packages/spike/.env.example packages/spike/.env   # then fill VITE_FALLBACK_SECRET
pnpm exec playwright install chromium                # once
pnpm spike:test                                      # headless regression, PASSES
pnpm spike                                           # manual: open http://localhost:5173
```

Key findings (what worked, and the traps):

- **passkey-kit version: 0.11.3** (pinned). 0.12.0 pulls
  `@openzeppelin/relayer-plugin-channels`, which needs Node >= 22.18.0 (this
  machine has 22.17.0 and `.npmrc` has `engine-strict=true`), so it won't
  install. 0.11.3 is the last release with the Launchtube-style `PasskeyServer`
  API and shares the same on-chain wallet interface (`passkey-kit-sdk@0.7.2`).
- **Constructor takes `walletWasmHash`, not `factoryContractId`** (the README is
  stale — read `node_modules/.../passkey-kit/src/kit.ts`). Wallet wasm hash used:
  `ecd990f0b45ca6817149b6175f79b32efb442f35731985a084131e8265c4cd90` (kalepail
  demo `next` branch; verified already installed on testnet via RPC).
- **stellar-base copy trap:** import `Keypair`/`TransactionBuilder` from
  `@stellar/stellar-base` (pinned 14.1.0), NOT from `@stellar/stellar-sdk/minimal`.
  The `/minimal` browser entry bundles its own stellar-base/js-xdr; mixing copies
  gives `XDR Write Error: <n> is not a O`.
- **Fallback resource fees:** after `kit.sign(...)`, re-simulate the tx in
  enforcing mode and `assembleTransaction(built, sim)` before submitting — the
  recording sim doesn't price the wallet's secp256r1 `__check_auth`. Launchtube
  hides this by re-simulating server-side.
- **Vite:** alias the `buffer` builtin to the npm polyfill and shim
  `globalThis.Buffer` (see `vite.config.ts` / `index.html`).
- **Launchtube: unreachable.** `testnet.launchtube.xyz` and the apex
  `launchtube.xyz` both fail DNS ("No such host is known") from this network,
  while all Stellar testnet hosts resolve fine. So the token endpoint
  (`/gen`) is unusable and the spike runs the **local sponsor fallback only**:
  a funded `spike-sponsor` key pays fees via a fee-bump (deploy) and as the tx
  source (register_issuer). Flip `VITE_LAUNCHTUBE_JWT` on to use the wired
  `server.send(...)` path once a reachable relay exists.
- **WebAuthn** requires a browser; the regression drives a Chrome CDP virtual
  authenticator (`WebAuthn.addVirtualAuthenticator`). Each run mints a fresh
  passkey/wallet, so it never hits `AlreadyRegistered`.
