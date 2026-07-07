$ErrorActionPreference = "Stop"

# 0. Refresh PATH from registry: a fresh shell may predate the Stellar CLI's
#    installer PATH update (see docs/DEV.md). Without this, `stellar` may not
#    be recognized even though it is installed.
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 1. Identity (idempotent): stellar CLI stores keys in its config dir
# NOTE: Windows PowerShell 5.1 does not raise catchable terminating errors
# for native-exe stderr failures, so try/catch around `stellar` calls is a
# no-op here; check $LASTEXITCODE instead.
$who = "probatum-admin"
stellar keys address $who | Out-Null
if ($LASTEXITCODE -ne 0) { stellar keys generate $who --network testnet }
$admin = stellar keys address $who
Write-Host "Admin: $admin"

# 2. Fund via friendbot (idempotent, ignores already-funded errors)
stellar keys fund $who --network testnet
if ($LASTEXITCODE -ne 0) { Write-Host "fund skipped (already funded or error)" }

# 3. Build + deploy
stellar contract build --manifest-path contracts/Cargo.toml
if ($LASTEXITCODE -ne 0) { throw "contract build failed (exit code $LASTEXITCODE)" }
$wasm = "contracts/target/wasm32v1-none/release/probatum.wasm"
$contractId = stellar contract deploy --wasm $wasm --source $who --network testnet
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($contractId)) { throw "contract deploy failed (exit code $LASTEXITCODE)" }
Write-Host "Contract: $contractId"

# 4. Init with admin
stellar contract invoke --id $contractId --source $who --network testnet -- init --admin $admin
if ($LASTEXITCODE -ne 0) { throw "init invoke failed (exit code $LASTEXITCODE)" }

# 5. Record deployment
$wasmHash = (Get-FileHash $wasm -Algorithm SHA256).Hash.ToLower()
$out = @{ network = "testnet"; contractId = "$contractId"; wasmHash = $wasmHash;
          adminPublic = "$admin"; deployedAt = (Get-Date).ToUniversalTime().ToString("o") } | ConvertTo-Json
New-Item -ItemType Directory -Force deployments | Out-Null
[System.IO.File]::WriteAllText("$PWD\deployments\testnet.json", $out, [System.Text.UTF8Encoding]::new($false))
Write-Host $out
