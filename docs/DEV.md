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
