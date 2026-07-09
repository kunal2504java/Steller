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

# 3. Build + deploy (constructor-based: v2 contract runs __constructor atomically
#    at deploy time, no separate init step / no init-front-running window)
stellar contract build --manifest-path contracts/Cargo.toml
if ($LASTEXITCODE -ne 0) { throw "contract build failed (exit code $LASTEXITCODE)" }
$wasm = "contracts/target/wasm32v1-none/release/probatum.wasm"
$contractId = stellar contract deploy --wasm $wasm --source $who --network testnet -- --admin $admin
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($contractId)) { throw "contract deploy failed (exit code $LASTEXITCODE)" }
Write-Host "Contract: $contractId"

# 4. Smoke test: version should be 2 (v2 contract)
$version = stellar contract invoke --id $contractId --source $who --network testnet -- version
if ($LASTEXITCODE -ne 0) { throw "version invoke failed (exit code $LASTEXITCODE)" }
Write-Host "Version: $version"

# 5. Seed: issuer + genesis batch (KAT root — keeps the demo batch claimable)
$profile = python -c "import hashlib; print(hashlib.sha256(b'probatum.app').hexdigest())"
$meta = python -c "import hashlib; print(hashlib.sha256(b'probatum-demo-batch-genesis').hexdigest())"
stellar contract invoke --id $contractId --source $who --network testnet -- register_issuer --issuer $admin --profile_hash $profile
if ($LASTEXITCODE -ne 0) { throw "seed register_issuer failed" }
# NOTE: `2>&1` on a native exe wraps every stderr line as a terminating
# NativeCommandError under $ErrorActionPreference = "Stop" (PS 5.1 quirk),
# even when the exe exits 0 — the CLI's tx status lines (which carry the
# genesis tx hash) go to stderr. Relax EAP just for this capture, restore
# it immediately after, and still gate on $LASTEXITCODE.
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$anchorOut = stellar contract invoke --id $contractId --source $who --network testnet -- anchor_batch --issuer $admin --root 57c49ece895537b2bf5dfe5ba421bbf7666f12a00d28a81c29ba0faa52cd1902 --meta $meta --count 4 2>&1 | Out-String
$ErrorActionPreference = $prevEAP
if ($LASTEXITCODE -ne 0) { throw "seed anchor_batch failed" }
$genesisTx = ([regex]::Match($anchorOut, "tx/([0-9a-f]{64})")).Groups[1].Value

# 6. Smoke test: batch_count should be 1 after seeding
$batchCount = stellar contract invoke --id $contractId --source $who --network testnet -- batch_count
if ($LASTEXITCODE -ne 0) { throw "batch_count invoke failed (exit code $LASTEXITCODE)" }
Write-Host "Batch count: $batchCount"

# 7. Record deployment
$wasmHash = (Get-FileHash $wasm -Algorithm SHA256).Hash.ToLower()
$out = @{ network = "testnet"; contractId = "$contractId"; wasmHash = $wasmHash;
          adminPublic = "$admin"; deployedAt = (Get-Date).ToUniversalTime().ToString("o");
          genesisTx = "$genesisTx" } | ConvertTo-Json
New-Item -ItemType Directory -Force deployments | Out-Null
[System.IO.File]::WriteAllText("$PWD\deployments\testnet.json", $out, [System.Text.UTF8Encoding]::new($false))
Write-Host $out
