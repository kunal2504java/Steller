# Candela Payments Implementation Plan (Plan 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sponsored, passkey-signed payments to candela-kit (pay/balance/links + `<PayButton>`), extend the sponsor guard and add a demo faucet, and ship a `/pay` playground + `/pay/[code]` payer page + landing Payments section on the unified server.

**Architecture:** A payment is a Stellar Asset Contract `transfer(from=passkey-wallet, to, amount)` built with `AssembledTransaction.buildWithOp` from `@stellar/stellar-sdk/minimal/contract` and pushed through the existing live-proven `signAndSubmit` path (passkey sign → enforcing re-sim → same-origin sponsor). No new Soroban contract. Payment requests are stateless base64url links. Spec: `docs/superpowers/specs/2026-07-17-candela-payments-design.md`.

**Tech Stack:** TypeScript, stellar-sdk 14.6.1 (`/minimal` contract module in the kit; full SDK server-side), @stellar/stellar-base 14.1.0, passkey-kit 0.11.3, Next 15.5.6, React 19.2.0, vitest 2, Playwright.

## Global Constraints

- Dependency pins are law (AGENTS.md §4): stellar-sdk 14.6.1 · stellar-base 14.1.0 · passkey-kit 0.11.3 · buffer 6.0.3 · next 15.5.6 · react 19.2.0 · tailwind 4.1.16. Add NO new dependencies (qrcode 1.5.4 is already in probatum-web).
- In `candela-kit`, `Keypair`/`TransactionBuilder` come from `@stellar/stellar-base`, NEVER `@stellar/stellar-sdk/minimal` (trap #1). Ops/ScVal helpers (`Operation`, `Address`, `Asset`, `nativeToScVal`, `scValToNative`, `StrKey`) also from `@stellar/stellar-base`.
- Server-side (`apps/probatum/src/lib`), use the full `@stellar/stellar-sdk` like `chain.ts`/`sponsor.ts` do.
- Secrets: sponsor secret only from env (`PROBATUM_SPONSOR_SECRET` / `CANDELA_SPONSOR_SECRET`). Never print, log, commit, or write it. Tx hashes/public keys are fine to record.
- `deployments/testnet.json` is the single source of truth — never hardcode a contract id or the native SAC id; derive the SAC via `Asset.native().contractId(passphrase)`.
- No fiat/INR/custody/tradeable-token/Aadhaar language anywhere in copy. Testnet-only demo.
- Design: monochrome tokens only, Inter + Fragment Mono, `data-reveal` sections, reduced-motion degrades to complete static frames, no horizontal scroll at 375px.
- Never run `next build` while that app's dev server is running (trap #8). The production server currently running on :3000 must be stopped before probatum builds (`Get-NetTCPConnection -LocalPort 3000`, kill owning PID).
- PowerShell 5.1: guard native exits with `$LASTEXITCODE`; don't trust `$?` after stderr redirects.
- `npm publish` of candela-kit remains GATED — never run it.
- Code snippets shown in UI must match the kit's real API exactly (provider prop is `network`, NOT `config`).
- Commits: conventional + scoped. Run tests before every commit.

---

### Task 1: SAC transfer foundation (`buildTransfer`) + live spike proof

The spike-first task from spec §11: prove the SAC-client construction by landing a real
transfer on testnet before anything builds on it.

**Files:**
- Modify: `packages/candela-kit/src/core/config.ts`
- Create: `packages/candela-kit/src/core/pay.ts` (partial: `nativeSacId`, `buildTransfer`)
- Test: `packages/candela-kit/tests/unit/sac-transfer.live.test.ts`

**Interfaces:**
- Consumes: `CandelaConfig` (`src/core/config.ts`), `BuiltAssembledTransaction` (`src/core/wallet.ts`).
- Produces: `CandelaConfig.sourceAccount?: string`; `nativeSacId(networkPassphrase: string): string`; `buildTransfer(cfg: CandelaConfig, args: { sac: string; from: string; to: string; amount: bigint }): Promise<BuiltAssembledTransaction<null>>`. Task 4's `pay()` and Task 7's faucet mirror rely on these exact names.

- [ ] **Step 1: Add `sourceAccount` to CandelaConfig**

In `packages/candela-kit/src/core/config.ts`, extend the type (keep everything else byte-identical):

```ts
export type CandelaConfig = {
  rpcUrl: string;
  networkPassphrase: string;
  walletWasmHash: string;
  launchtube?: { url: string; jwt: string };
  /** Same-origin endpoint that signs/submits without exposing its sponsor key. */
  submissionUrl?: string;
  /** Fallback sponsor (testnet/dev). NEVER commit a real secret. */
  sponsorSecret?: string;
  /**
   * PUBLIC account (G...) used as the transaction source when building
   * sponsored contract calls (e.g. payments). This is the sponsor's public
   * key — public information, not a secret.
   */
  sourceAccount?: string;
};
```

- [ ] **Step 2: Write the failing test (offline shape assertions + gated live proof)**

Create `packages/candela-kit/tests/unit/sac-transfer.live.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Keypair, xdr, Address, scValToNative } from "@stellar/stellar-base";
import { Server } from "@stellar/stellar-sdk/minimal/rpc";
import { nativeSacId, buildTransfer } from "../../src/core/pay";
import { resolveConfig } from "../../src/core/config";

const SECRET = process.env.CANDELA_SPONSOR_SECRET;

describe("nativeSacId", () => {
  it("derives a deterministic C-address for testnet", () => {
    const sac = nativeSacId("Test SDF Network ; September 2015");
    expect(sac).toMatch(/^C[A-Z2-7]{55}$/);
    expect(nativeSacId("Test SDF Network ; September 2015")).toBe(sac);
    // A different network derives a different SAC.
    expect(nativeSacId("Public Global Stellar Network ; September 2015")).not.toBe(sac);
  });
});

describe("buildTransfer", () => {
  it("requires cfg.sourceAccount", async () => {
    const cfg = resolveConfig("testnet");
    await expect(
      buildTransfer(cfg, {
        sac: nativeSacId(cfg.networkPassphrase),
        from: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        to: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
        amount: 1n,
      }),
    ).rejects.toThrow(/sourceAccount/);
  });
});

describe.skipIf(!SECRET)("live SAC transfer (CANDELA_SPONSOR_SECRET set)", () => {
  it("lands a classically-signed native transfer on testnet", async () => {
    const sponsor = Keypair.fromSecret(SECRET!);
    const cfg = { ...resolveConfig("testnet"), sourceAccount: sponsor.publicKey() };
    const sac = nativeSacId(cfg.networkPassphrase);
    // 0.1 XLM = 1_000_000 stroops, sponsor pays itself → zero net cost.
    const assembled = await buildTransfer(cfg, {
      sac,
      from: sponsor.publicKey(),
      to: sponsor.publicKey(),
      amount: 1_000_000n,
    });
    expect(assembled.built).toBeTruthy();
    // Verify the encoded invocation args before submitting.
    const op = assembled.built.toEnvelope().v1().tx().operations()[0];
    const invocation = op.body().invokeHostFunctionOp().hostFunction().invokeContract();
    expect(invocation.functionName().toString()).toBe("transfer");
    expect(Address.fromScAddress(invocation.contractAddress()).toString()).toBe(sac);
    expect(scValToNative(invocation.args()[2])).toBe(1_000_000n);
    // Classic source-account auth: sign the envelope and submit directly.
    (assembled.built as any).sign(sponsor);
    const server = new Server(cfg.rpcUrl);
    const sent = await server.sendTransaction(assembled.built as any);
    expect(sent.status).not.toBe("ERROR");
    let confirmed = "";
    for (let i = 0; i < 30; i++) {
      const res = await server.getTransaction(sent.hash);
      if (res.status === "SUCCESS") { confirmed = sent.hash; break; }
      if (res.status !== "NOT_FOUND") throw new Error(`tx failed: ${res.status}`);
      await new Promise((r) => setTimeout(r, 1500));
    }
    expect(confirmed).toMatch(/^[0-9a-f]{64}$/);
    console.log("SPIKE PROOF transfer tx:", confirmed); // hash is public — fine to log
  }, 120_000);
});
```

- [ ] **Step 3: Run tests to verify they fail correctly**

Run: `pnpm --filter candela-kit test`
Expected: FAIL — `Cannot find module '../../src/core/pay'` (or "nativeSacId is not exported"). The live describe is skipped (env var not set in this step).

- [ ] **Step 4: Implement `src/core/pay.ts` (partial)**

```ts
// Payments core: a payment is a Stellar Asset Contract `transfer` invoked by
// the passkey smart wallet. Built with the /minimal contract module so the
// output is the same BuiltAssembledTransaction shape signAndSubmit accepts.
import { Address, Asset, Operation, nativeToScVal } from "@stellar/stellar-base";
import { AssembledTransaction } from "@stellar/stellar-sdk/minimal/contract";
import type { CandelaConfig } from "./config";
import type { BuiltAssembledTransaction } from "./wallet";

/** The network's native XLM Stellar Asset Contract — derived, never hardcoded. */
export function nativeSacId(networkPassphrase: string): string {
  return Asset.native().contractId(networkPassphrase);
}

/**
 * Build (and simulate) a SAC `transfer(from, to, amount)` as an
 * AssembledTransaction ready for `signAndSubmit`. The recording simulation
 * generates the wallet's SorobanAuthorizationEntry; kit.sign() later signs it
 * with the passkey. `cfg.sourceAccount` (the sponsor's PUBLIC account) is the
 * transaction source, mirroring how the claim flow builds with the sponsor
 * as source so the server can sign-as-source after validation.
 */
export async function buildTransfer(
  cfg: CandelaConfig,
  args: { sac: string; from: string; to: string; amount: bigint },
): Promise<BuiltAssembledTransaction<null>> {
  if (!cfg.sourceAccount) {
    throw new Error(
      "cfg.sourceAccount (public sponsor account) is required to build sponsored payments",
    );
  }
  const operation = Operation.invokeContractFunction({
    contract: args.sac,
    function: "transfer",
    args: [
      new Address(args.from).toScVal(),
      new Address(args.to).toScVal(),
      nativeToScVal(args.amount, { type: "i128" }),
    ],
  });
  const assembled = await AssembledTransaction.buildWithOp(operation as any, {
    contractId: args.sac,
    networkPassphrase: cfg.networkPassphrase,
    rpcUrl: cfg.rpcUrl,
    publicKey: cfg.sourceAccount,
    method: "transfer",
    parseResultXdr: () => null,
  });
  const built = assembled as BuiltAssembledTransaction<null>;
  if (!built.built) throw new Error("transfer simulation did not assemble a transaction");
  return built;
}
```

Before finalizing, read the installed source to confirm the option names:
`node_modules/.pnpm/@stellar+stellar-sdk@14.6.1/node_modules/@stellar/stellar-sdk/lib/minimal/contract/assembled_transaction.d.ts`
(`buildWithOp<T>(operation: xdr.Operation, options: AssembledTransactionOptions<T>)`, options = `MethodOptions & ClientOptions & { method, args?, parseResultXdr, ... }` — verified 2026-07-17).

- [ ] **Step 5: Run offline tests**

Run: `pnpm --filter candela-kit test`
Expected: PASS (live describe reported as skipped).

- [ ] **Step 6: Run the live spike**

In PowerShell, set the env var from the same funded sponsor `apps/probatum/.env` uses — copy the VALUE of `PROBATUM_SPONSOR_SECRET` manually into the command below; NEVER echo or log it:

```powershell
$env:CANDELA_SPONSOR_SECRET = (Get-Content apps/probatum/.env | Where-Object { $_ -match '^PROBATUM_SPONSOR_SECRET=' }) -replace '^PROBATUM_SPONSOR_SECRET=',''
pnpm --filter candela-kit test
Remove-Item Env:CANDELA_SPONSOR_SECRET
```

Expected: PASS including the live describe; console prints `SPIKE PROOF transfer tx: <64-hex>`. Record the hash in your report (it is public). If `buildWithOp` rejects the op shape, STOP and re-read the installed `assembled_transaction.js` — do not guess.

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm --filter candela-kit typecheck`
Expected: exit 0.

```powershell
git add packages/candela-kit/src/core/config.ts packages/candela-kit/src/core/pay.ts packages/candela-kit/tests/unit/sac-transfer.live.test.ts
git commit -m "feat(candela-kit): SAC transfer builder proven live on testnet"
```

---

### Task 2: Amount math (pure, no floats)

**Files:**
- Create: `packages/candela-kit/src/core/amount.ts`
- Test: `packages/candela-kit/tests/unit/amount.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseAmount(value: string, decimals: number): bigint` (throws on invalid) and `formatAmount(raw: bigint, decimals: number): string`. Task 4's `pay()` and `getBalance()` call these.

- [ ] **Step 1: Write the failing tests**

Create `packages/candela-kit/tests/unit/amount.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseAmount, formatAmount } from "../../src/core/amount";

describe("parseAmount", () => {
  it("converts decimal strings to raw units", () => {
    expect(parseAmount("25", 7)).toBe(250_000_000n);
    expect(parseAmount("0.5", 7)).toBe(5_000_000n);
    expect(parseAmount("0.0000001", 7)).toBe(1n);
    expect(parseAmount("1", 0)).toBe(1n);
  });
  it.each([
    ["empty", ""],
    ["negative", "-1"],
    ["zero", "0"],
    ["zero point zero", "0.0"],
    ["not a number", "1e5"],
    ["comma", "1,5"],
    ["trailing dot", "1."],
    ["two dots", "1.2.3"],
  ])("rejects %s", (_label, value) => {
    expect(() => parseAmount(value, 7)).toThrow();
  });
  it("rejects more fractional digits than the asset supports", () => {
    expect(() => parseAmount("0.00000001", 7)).toThrow(/decimal places/);
  });
  it("rejects values beyond i128", () => {
    expect(() => parseAmount((2n ** 127n).toString(), 0)).toThrow(/i128/);
  });
});

describe("formatAmount", () => {
  it("renders raw units as trimmed decimal strings", () => {
    expect(formatAmount(250_000_000n, 7)).toBe("25");
    expect(formatAmount(5_000_000n, 7)).toBe("0.5");
    expect(formatAmount(1n, 7)).toBe("0.0000001");
    expect(formatAmount(0n, 7)).toBe("0");
    expect(formatAmount(42n, 0)).toBe("42");
  });
  it("round-trips with parseAmount", () => {
    for (const v of ["1", "0.25", "9999999.9999999"]) {
      expect(formatAmount(parseAmount(v, 7), 7)).toBe(v);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter candela-kit test`
Expected: FAIL — cannot find `../../src/core/amount`.

- [ ] **Step 3: Implement `src/core/amount.ts`**

```ts
// Decimal-string ↔ raw-unit (i128) conversion. Pure BigInt math — floats
// never touch an amount anywhere in the kit.
const MAX_I128 = (1n << 127n) - 1n;
const AMOUNT_RE = /^(\d+)(?:\.(\d+))?$/;

export function parseAmount(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 38) {
    throw new Error(`invalid decimals: ${decimals}`);
  }
  const match = AMOUNT_RE.exec(value.trim());
  if (!match) throw new Error(`invalid amount: "${value}"`);
  const whole = match[1];
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) {
    throw new Error(`amount "${value}" exceeds ${decimals} decimal places`);
  }
  const raw = BigInt(whole + fraction.padEnd(decimals, "0"));
  if (raw <= 0n) throw new Error("amount must be positive");
  if (raw > MAX_I128) throw new Error("amount exceeds i128 range");
  return raw;
}

export function formatAmount(raw: bigint, decimals: number): string {
  if (raw < 0n) throw new Error("negative amount");
  const s = raw.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const fraction = decimals > 0 ? s.slice(s.length - decimals).replace(/0+$/, "") : "";
  return fraction ? `${whole}.${fraction}` : whole;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter candela-kit test`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/candela-kit/src/core/amount.ts packages/candela-kit/tests/unit/amount.test.ts
git commit -m "feat(candela-kit): pure i128 amount math"
```

---

### Task 3: Payment-request codec (stateless links + SEP-7)

**Files:**
- Create: `packages/candela-kit/src/core/payRequest.ts`
- Test: `packages/candela-kit/tests/unit/pay-request.test.ts`

**Interfaces:**
- Consumes: nothing (pure; `StrKey` from stellar-base for address validation).
- Produces: `type PayRequest = { to: string; amount?: string; asset?: string; memo?: string }`; `encodePayRequest(req: PayRequest): string` (base64url); `decodePayRequest(code: string): PayRequest` (throws on tamper/junk); `toSep7(req: PayRequest): string`. Tasks 4/5/8/9 consume these exact names.

- [ ] **Step 1: Write the failing tests**

Create `packages/candela-kit/tests/unit/pay-request.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { encodePayRequest, decodePayRequest, toSep7 } from "../../src/core/payRequest";

const G = "GAT3GZE2HZ4CRHMSWI2CFART4DBCSXNSFBX7Z2NOJLNEUF5U37ZDRFBY";
const C = "CC7MQBZ2WOXGLOMX5MDZ4IXT5WHEII7SUK6LMXXKUKOGLARDGG66AOJL";

describe("pay request codec", () => {
  it("round-trips a full request", () => {
    const req = { to: G, amount: "25", memo: "Tip the builder" };
    expect(decodePayRequest(encodePayRequest(req))).toEqual(req);
  });
  it("round-trips a minimal request (to only, C-address)", () => {
    expect(decodePayRequest(encodePayRequest({ to: C }))).toEqual({ to: C });
  });
  it("produces URL-safe output", () => {
    const code = encodePayRequest({ to: G, amount: "0.5", memo: "hello world ✓" });
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it.each([
    ["bad recipient", { to: "not-an-address" }],
    ["bad amount", { to: G, amount: "1,5" }],
    ["bad asset", { to: G, asset: G }], // asset must be a C contract address
    ["oversized memo", { to: G, memo: "x".repeat(121) }],
  ])("encode rejects %s", (_label, req) => {
    expect(() => encodePayRequest(req as never)).toThrow();
  });
  it("decode rejects tampered and junk codes", () => {
    const code = encodePayRequest({ to: G, amount: "1" });
    const tampered = (code[0] === "A" ? "B" : "A") + code.slice(1);
    expect(() => decodePayRequest(tampered)).toThrow();
    expect(() => decodePayRequest("!!not-base64url!!")).toThrow();
    expect(() => decodePayRequest("aGVsbG8")).toThrow(); // valid b64 of "hello", not JSON
  });
});

describe("toSep7", () => {
  it("emits the standards-track pay URI", () => {
    expect(toSep7({ to: G, amount: "25", memo: "thanks" })).toBe(
      `web+stellar:pay?destination=${G}&amount=25&memo=thanks&memo_type=MEMO_TEXT`,
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter candela-kit test`
Expected: FAIL — cannot find `../../src/core/payRequest`.

- [ ] **Step 3: Implement `src/core/payRequest.ts`**

```ts
// Stateless payment requests: the link IS the request. base64url of a
// canonical JSON object — no database, nothing stored, nothing operated.
import { Buffer } from "buffer";
import { StrKey } from "@stellar/stellar-base";

export type PayRequest = {
  /** Recipient: classic G... account or C... contract (smart wallet). */
  to: string;
  /** Decimal string, e.g. "25" or "0.5". Omitted = payer chooses. */
  amount?: string;
  /** SAC contract address. Omitted = the network's native XLM SAC. */
  asset?: string;
  /** Display-only note (link, payer page, OG). NOT written on-chain. */
  memo?: string;
};

const AMOUNT_RE = /^\d+(?:\.\d+)?$/;

function assertValid(req: PayRequest): PayRequest {
  if (typeof req.to !== "string" ||
      (!StrKey.isValidEd25519PublicKey(req.to) && !StrKey.isValidContract(req.to))) {
    throw new Error("invalid recipient address");
  }
  if (req.amount !== undefined &&
      (typeof req.amount !== "string" || !AMOUNT_RE.test(req.amount))) {
    throw new Error("invalid amount");
  }
  if (req.asset !== undefined && !StrKey.isValidContract(req.asset)) {
    throw new Error("invalid asset contract address");
  }
  if (req.memo !== undefined && (typeof req.memo !== "string" || req.memo.length > 120)) {
    throw new Error("invalid memo");
  }
  // Canonical key order so encoding is deterministic.
  return {
    to: req.to,
    ...(req.amount !== undefined ? { amount: req.amount } : {}),
    ...(req.asset !== undefined ? { asset: req.asset } : {}),
    ...(req.memo !== undefined ? { memo: req.memo } : {}),
  };
}

// buffer@6 has no "base64url" encoding — translate manually.
export function encodePayRequest(req: PayRequest): string {
  const json = JSON.stringify(assertValid(req));
  return Buffer.from(json, "utf8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePayRequest(code: string): PayRequest {
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]+$/.test(code)) {
    throw new Error("invalid payment code");
  }
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    throw new Error("invalid payment code");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("invalid payment code");
  }
  return assertValid(parsed as PayRequest);
}

/** Interop bonus: the SEP-7 `web+stellar:pay` URI for the same request. */
export function toSep7(req: PayRequest): string {
  const clean = assertValid(req);
  const params = new URLSearchParams({ destination: clean.to });
  if (clean.amount) params.set("amount", clean.amount);
  if (clean.memo) {
    params.set("memo", clean.memo);
    params.set("memo_type", "MEMO_TEXT");
  }
  return `web+stellar:pay?${params.toString()}`;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter candela-kit test`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add packages/candela-kit/src/core/payRequest.ts packages/candela-kit/tests/unit/pay-request.test.ts
git commit -m "feat(candela-kit): stateless pay-request codec with SEP-7 helper"
```

---

### Task 4: `pay()`, `getDecimals()`, `getBalance()` + public exports

**Files:**
- Modify: `packages/candela-kit/src/core/pay.ts` (extend Task 1's file)
- Modify: `packages/candela-kit/src/index.ts`
- Test: `packages/candela-kit/tests/unit/pay.test.ts`

**Interfaces:**
- Consumes: Task 1 `buildTransfer`/`nativeSacId`; Task 2 `parseAmount`/`formatAmount`; Task 3 `PayRequest`; `signAndSubmit`, `SignAndSubmitOptions`, `CandelaWallet` from `src/core/wallet.ts`.
- Produces (Tasks 5/8/9 rely on these):
  - `type Balance = { raw: bigint; formatted: string; decimals: number }`
  - `type PayOptions = SignAndSubmitOptions & { onBuilt?: () => void }`
  - `pay(cfg, wallet, request: PayRequest, options?: PayOptions, deps?): Promise<{ hash: string; status: string }>`
  - `getDecimals(cfg, asset?: string): Promise<number>` (cached per network|asset)
  - `getBalance(cfg, account: string, asset?: string): Promise<Balance>`
  - The `deps` parameter is the repo's DI-default idiom (see `apps/probatum/src/app/api/candela/submit/handler.ts`) so unit tests never hit the network.

- [ ] **Step 1: Write the failing tests**

Create `packages/candela-kit/tests/unit/pay.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { pay } from "../../src/core/pay";
import { resolveConfig } from "../../src/core/config";

const wallet = { contractId: "CC7MQBZ2WOXGLOMX5MDZ4IXT5WHEII7SUK6LMXXKUKOGLARDGG66AOJL", keyIdBase64: "a2V5" };
const G = "GAT3GZE2HZ4CRHMSWI2CFART4DBCSXNSFBX7Z2NOJLNEUF5U37ZDRFBY";

function testDeps() {
  const assembled = { built: {} } as never;
  return {
    assembled,
    deps: {
      getDecimals: vi.fn(async () => 7),
      buildTransfer: vi.fn(async () => assembled),
      signAndSubmit: vi.fn(async () => ({ hash: "ab".repeat(32), status: "SUCCESS" })),
    },
  };
}

describe("pay", () => {
  const cfg = { ...resolveConfig("testnet"), sourceAccount: G };

  it("resolves decimals, builds the transfer from the wallet, and submits", async () => {
    const { deps, assembled } = testDeps();
    const onBuilt = vi.fn();
    const res = await pay(cfg, wallet, { to: G, amount: "2.5" }, { onBuilt }, deps);
    expect(res.status).toBe("SUCCESS");
    expect(deps.getDecimals).toHaveBeenCalledWith(cfg, undefined);
    expect(deps.buildTransfer).toHaveBeenCalledWith(cfg, expect.objectContaining({
      from: wallet.contractId,
      to: G,
      amount: 25_000_000n,
    }));
    expect(onBuilt).toHaveBeenCalledOnce();
    expect(deps.signAndSubmit).toHaveBeenCalledWith(cfg, wallet, assembled, expect.anything());
  });

  it("passes a custom asset through to decimals and transfer", async () => {
    const { deps } = testDeps();
    const asset = wallet.contractId; // any C-address stands in for a SAC
    await pay(cfg, wallet, { to: G, amount: "1", asset }, {}, deps);
    expect(deps.getDecimals).toHaveBeenCalledWith(cfg, asset);
    expect(deps.buildTransfer).toHaveBeenCalledWith(cfg, expect.objectContaining({ sac: asset }));
  });

  it("rejects a request without an amount", async () => {
    const { deps } = testDeps();
    await expect(pay(cfg, wallet, { to: G }, {}, deps)).rejects.toThrow(/amount/);
    expect(deps.buildTransfer).not.toHaveBeenCalled();
  });

  it("rejects an invalid recipient before any network work", async () => {
    const { deps } = testDeps();
    await expect(pay(cfg, wallet, { to: "junk", amount: "1" }, {}, deps)).rejects.toThrow();
    expect(deps.buildTransfer).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter candela-kit test`
Expected: FAIL — `pay` is not exported from `../../src/core/pay`.

- [ ] **Step 3: Extend `src/core/pay.ts`**

Add below the Task 1 code (new imports merge into the existing import block):

```ts
import { scValToNative } from "@stellar/stellar-base";
import { signAndSubmit, type CandelaWallet, type SignAndSubmitOptions } from "./wallet";
import { parseAmount, formatAmount } from "./amount";
import { encodePayRequest, decodePayRequest, type PayRequest } from "./payRequest";
```

(Merge into Task 1's existing import block — `Address`, `Asset`, `Operation`,
`nativeToScVal`, and `AssembledTransaction` are already imported there; add
`scValToNative` to the stellar-base line and do not import anything twice.)

```ts
export type Balance = { raw: bigint; formatted: string; decimals: number };
export type PayOptions = SignAndSubmitOptions & { onBuilt?: () => void };

const decimalsCache = new Map<string, number>();

async function readSac<T>(
  cfg: CandelaConfig,
  sac: string,
  method: "decimals" | "balance",
  args: unknown[],
): Promise<T> {
  // Read-only simulation: no publicKey needed (the contract module uses its
  // NULL account for reads), no fee, no auth.
  const tx = await AssembledTransaction.build({
    contractId: sac,
    networkPassphrase: cfg.networkPassphrase,
    rpcUrl: cfg.rpcUrl,
    method,
    args: args as never[],
    parseResultXdr: (v) => scValToNative(v) as T,
  });
  return tx.result as T;
}

/** SAC `decimals()` — cached per (network, asset). XLM is 7. */
export async function getDecimals(cfg: CandelaConfig, asset?: string): Promise<number> {
  const sac = asset ?? nativeSacId(cfg.networkPassphrase);
  const key = `${cfg.networkPassphrase}|${sac}`;
  const cached = decimalsCache.get(key);
  if (cached !== undefined) return cached;
  const decimals = Number(await readSac<number | bigint>(cfg, sac, "decimals", []));
  decimalsCache.set(key, decimals);
  return decimals;
}

/** SAC `balance(id)` for a G or C address, formatted with the asset's decimals. */
export async function getBalance(
  cfg: CandelaConfig,
  account: string,
  asset?: string,
): Promise<Balance> {
  const sac = asset ?? nativeSacId(cfg.networkPassphrase);
  const decimals = await getDecimals(cfg, asset);
  const raw = BigInt(
    await readSac<bigint>(cfg, sac, "balance", [new Address(account).toScVal()]),
  );
  return { raw, formatted: formatAmount(raw, decimals), decimals };
}

/**
 * Sponsored, passkey-signed payment: SAC transfer from the connected smart
 * wallet, through the same signAndSubmit path every Candela action uses.
 */
export async function pay(
  cfg: CandelaConfig,
  wallet: CandelaWallet,
  request: PayRequest,
  options: PayOptions = {},
  deps = { getDecimals, buildTransfer, signAndSubmit },
): Promise<{ hash: string; status: string }> {
  if (!request.amount) throw new Error("payment request has no amount");
  // Re-validate via the codec's rules: round-tripping throws on bad input.
  const { to, asset } = request;
  const sac = asset ?? nativeSacId(cfg.networkPassphrase);
  const decimals = await deps.getDecimals(cfg, asset);
  const amount = parseAmount(request.amount, decimals);
  const assembled = await deps.buildTransfer(cfg, {
    sac,
    from: wallet.contractId,
    to,
    amount,
  });
  options.onBuilt?.();
  return deps.signAndSubmit(cfg, wallet, assembled, { onSigned: options.onSigned });
}
```

For the "invalid recipient" test: `buildTransfer` is mocked, so validation must happen in
`pay()` — add after the amount guard:

```ts
  import { decodePayRequest, encodePayRequest } from "./payRequest"; // top of file
  // Throws on invalid to/asset/memo shapes before any network call.
  decodePayRequest(encodePayRequest(request));
```

- [ ] **Step 4: Export the payments surface from `src/index.ts`**

Append to `packages/candela-kit/src/index.ts`:

```ts
export { parseAmount, formatAmount } from "./core/amount";
export {
  encodePayRequest,
  decodePayRequest,
  toSep7,
  type PayRequest,
} from "./core/payRequest";
export {
  pay,
  getBalance,
  getDecimals,
  buildTransfer,
  nativeSacId,
  type Balance,
  type PayOptions,
} from "./core/pay";
```

- [ ] **Step 5: Run tests + typecheck + build**

Run: `pnpm --filter candela-kit test` → PASS
Run: `pnpm --filter candela-kit typecheck` → exit 0
Run: `pnpm --filter candela-kit build` → tsup completes, dts emitted, no errors.

- [ ] **Step 6: Commit**

```powershell
git add packages/candela-kit/src/core/pay.ts packages/candela-kit/src/index.ts packages/candela-kit/tests/unit/pay.test.ts
git commit -m "feat(candela-kit): pay(), getBalance(), getDecimals() public API"
```

---

### Task 5: React surface — `usePay`, `useBalance`, `<PayButton>` + provider `sourceAccount`

**Files:**
- Modify: `packages/candela-kit/src/react/context.tsx` (add `sourceAccount` prop)
- Create: `packages/candela-kit/src/react/usePay.ts`
- Create: `packages/candela-kit/src/react/useBalance.ts`
- Create: `packages/candela-kit/src/react/PayButton.tsx`
- Modify: `packages/candela-kit/src/index.ts`
- Test: `packages/candela-kit/tests/unit/use-pay.test.tsx`, `packages/candela-kit/tests/unit/pay-button.test.tsx`

**Interfaces:**
- Consumes: Task 4 `pay`/`getBalance`/`Balance`; `useCandela` context (`{ config, wallet, setWallet, isHydrated }`); existing button idioms in `src/react/buttons.tsx` (`data-candela` attrs, `role="alert"` error span).
- Produces (Tasks 8/9 rely on these):
  - `CandelaProvider` new optional prop `sourceAccount?: string` (merged into config exactly like `submissionUrl`)
  - `usePay(): { pay(request: PayRequest): Promise<{hash,status}>, state: PayState }` with `PayState` phases `idle | building | signing | submitting | confirmed | failed`
  - `useBalance(account?: string, asset?: string): { balance: Balance | null, loading: boolean, error: string | null, refresh(): Promise<void> }`
  - `PayButton` props: `{ to: string; amount?: string; asset?: string; memo?: string; onPaid?: (hash: string) => void; className?: string; children?: React.ReactNode }`, rendered as `<span data-candela="pay" data-pay-phase={state.phase}>` wrapping a button.

- [ ] **Step 1: Write the failing tests**

Create `packages/candela-kit/tests/unit/use-pay.test.tsx` (follow the render idioms already in `tests/unit/use-submit.test.tsx` — read it first and reuse its harness style):

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const payMock = vi.fn();
const balanceMock = vi.fn();
vi.mock("../../src/core/pay", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  pay: (...args: unknown[]) => payMock(...args),
  getBalance: (...args: unknown[]) => balanceMock(...args),
}));

import { CandelaProvider, useCandela } from "../../src/react/context";
import { usePay } from "../../src/react/usePay";
import { useBalance } from "../../src/react/useBalance";

const WALLET = { contractId: "CC7MQBZ2WOXGLOMX5MDZ4IXT5WHEII7SUK6LMXXKUKOGLARDGG66AOJL", keyIdBase64: "a2V5" };
const G = "GAT3GZE2HZ4CRHMSWI2CFART4DBCSXNSFBX7Z2NOJLNEUF5U37ZDRFBY";

function Seed({ children }: { children: React.ReactNode }) {
  const { setWallet } = useCandela();
  React.useEffect(() => setWallet(WALLET), [setWallet]);
  return <>{children}</>;
}

function PayProbe() {
  const { pay, state } = usePay();
  return (
    <div>
      <button onClick={() => void pay({ to: G, amount: "1" }).catch(() => {})}>go</button>
      <output>{state.phase}{state.phase === "confirmed" ? `:${state.hash}` : ""}</output>
    </div>
  );
}

function BalanceProbe() {
  const { balance, loading } = useBalance();
  return <output>{loading ? "loading" : balance?.formatted ?? "none"}</output>;
}

beforeEach(() => {
  payMock.mockReset();
  balanceMock.mockReset();
});

describe("usePay", () => {
  it("walks building → signing → submitting → confirmed", async () => {
    payMock.mockImplementation(async (_cfg, _w, _req, opts) => {
      opts.onBuilt?.();
      opts.onSigned?.();
      return { hash: "cd".repeat(32), status: "SUCCESS" };
    });
    render(
      <CandelaProvider network="testnet" sourceAccount={G}>
        <Seed><PayProbe /></Seed>
      </CandelaProvider>,
    );
    screen.getByText("go").click();
    await waitFor(() => expect(screen.getByText(/^confirmed:/)).toBeTruthy());
    expect(payMock).toHaveBeenCalledOnce();
    // sourceAccount flowed into the config the hook handed to pay()
    expect(payMock.mock.calls[0][0]).toMatchObject({ sourceAccount: G });
  });

  it("reports failed with the error", async () => {
    payMock.mockRejectedValue(new Error("boom"));
    render(
      <CandelaProvider network="testnet"><Seed><PayProbe /></Seed></CandelaProvider>,
    );
    screen.getByText("go").click();
    await waitFor(() => expect(screen.getByText(/failed/)).toBeTruthy());
  });
});

describe("useBalance", () => {
  it("fetches the connected wallet's balance and exposes formatted value", async () => {
    balanceMock.mockResolvedValue({ raw: 100_000_000n, formatted: "10", decimals: 7 });
    render(
      <CandelaProvider network="testnet"><Seed><BalanceProbe /></Seed></CandelaProvider>,
    );
    await waitFor(() => expect(screen.getByText("10")).toBeTruthy());
    expect(balanceMock).toHaveBeenCalledWith(expect.anything(), WALLET.contractId, undefined);
  });

  it("stays empty with no wallet connected", async () => {
    render(
      <CandelaProvider network="testnet"><BalanceProbe /></CandelaProvider>,
    );
    await waitFor(() => expect(screen.getByText("none")).toBeTruthy());
    expect(balanceMock).not.toHaveBeenCalled();
  });
});
```

Create `packages/candela-kit/tests/unit/pay-button.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const payMock = vi.fn();
vi.mock("../../src/core/pay", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  pay: (...args: unknown[]) => payMock(...args),
}));

import { CandelaProvider, useCandela } from "../../src/react/context";
import { PayButton } from "../../src/react/PayButton";

const WALLET = { contractId: "CC7MQBZ2WOXGLOMX5MDZ4IXT5WHEII7SUK6LMXXKUKOGLARDGG66AOJL", keyIdBase64: "a2V5" };
const G = "GAT3GZE2HZ4CRHMSWI2CFART4DBCSXNSFBX7Z2NOJLNEUF5U37ZDRFBY";

function Seed({ children }: { children: React.ReactNode }) {
  const { setWallet } = useCandela();
  React.useEffect(() => setWallet(WALLET), [setWallet]);
  return <>{children}</>;
}

beforeEach(() => payMock.mockReset());

describe("PayButton", () => {
  it("is disabled without a connected wallet", () => {
    render(
      <CandelaProvider network="testnet"><PayButton to={G} amount="1" /></CandelaProvider>,
    );
    expect(screen.getByRole("button")).toHaveProperty("disabled", true);
  });

  it("pays and reports the hash via onPaid", async () => {
    payMock.mockResolvedValue({ hash: "ef".repeat(32), status: "SUCCESS" });
    const onPaid = vi.fn();
    render(
      <CandelaProvider network="testnet">
        <Seed><PayButton to={G} amount="1" onPaid={onPaid} /></Seed>
      </CandelaProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button")).toHaveProperty("disabled", false));
    screen.getByRole("button").click();
    await waitFor(() => expect(onPaid).toHaveBeenCalledWith("ef".repeat(32)));
    expect(screen.getByText("Paid ✓")).toBeTruthy();
  });

  it("surfaces failure via role=alert and allows retry", async () => {
    payMock.mockRejectedValue(new Error("no funds"));
    render(
      <CandelaProvider network="testnet">
        <Seed><PayButton to={G} amount="1" /></Seed>
      </CandelaProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button")).toHaveProperty("disabled", false));
    screen.getByRole("button").click();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/no funds/));
    expect(screen.getByRole("button")).toHaveProperty("disabled", false);
  });
});
```

Note for the implementer: `tests/unit/use-submit.test.tsx` and
`tests/unit/provider-storage.test.tsx` already exist — READ them first and match their
setup (jsdom, testing-library imports, any shared helpers). If `@testing-library/react`
is not among candela-kit devDependencies, check how the existing .tsx tests render — use
the exact same tooling; do NOT add a new dependency without checking first.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter candela-kit test`
Expected: FAIL — `usePay`/`useBalance`/`PayButton` modules missing; also `sourceAccount` prop unknown.

- [ ] **Step 3: Add `sourceAccount` to `CandelaProvider`**

In `src/react/context.tsx`, extend the props and config merge (pattern identical to `submissionUrl`):

```tsx
export function CandelaProvider({
  network,
  submissionUrl,
  sourceAccount,
  storageKey,
  children,
}: {
  network: "testnet" | CandelaConfig;
  submissionUrl?: string;
  sourceAccount?: string;
  storageKey?: string;
  children: ReactNode;
}) {
  const config = useMemo(
    () => ({
      ...resolveConfig(network),
      ...(submissionUrl ? { submissionUrl } : {}),
      ...(sourceAccount ? { sourceAccount } : {}),
    }),
    [network, submissionUrl, sourceAccount],
  );
```

(The rest of the file is untouched.)

- [ ] **Step 4: Implement `src/react/usePay.ts`**

```tsx
"use client";
import { useState } from "react";
import { useCandela } from "./context";
import { pay as corePay } from "../core/pay";
import type { PayRequest } from "../core/payRequest";

export type PayState =
  | { phase: "idle" }
  | { phase: "building" }
  | { phase: "signing" }
  | { phase: "submitting" }
  | { phase: "confirmed"; hash: string }
  | { phase: "failed"; error: string };

export function usePay() {
  const { config, wallet } = useCandela();
  const [state, setState] = useState<PayState>({ phase: "idle" });

  async function pay(request: PayRequest) {
    if (!wallet) throw new Error("no wallet connected");
    setState({ phase: "building" });
    try {
      const res = await corePay(config, wallet, request, {
        onBuilt: () => setState({ phase: "signing" }),
        onSigned: () => setState({ phase: "submitting" }),
      });
      setState({ phase: "confirmed", hash: res.hash });
      return res;
    } catch (e) {
      setState({ phase: "failed", error: String(e) });
      throw e;
    }
  }

  return { pay, state };
}
```

- [ ] **Step 5: Implement `src/react/useBalance.ts`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useCandela } from "./context";
import { getBalance, type Balance } from "../core/pay";

export function useBalance(account?: string, asset?: string) {
  const { config, wallet } = useCandela();
  const target = account ?? wallet?.contractId ?? null;
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!target) {
      setBalance(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setBalance(await getBalance(config, target, asset));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [config, target, asset]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balance, loading, error, refresh };
}
```

- [ ] **Step 6: Implement `src/react/PayButton.tsx`**

```tsx
"use client";
import { useCandela } from "./context";
import { usePay } from "./usePay";
import type { PayRequest } from "../core/payRequest";

type PayButtonProps = PayRequest & {
  onPaid?: (hash: string) => void;
  className?: string;
  children?: React.ReactNode;
};

export function PayButton({
  to,
  amount,
  asset,
  memo,
  onPaid,
  className,
  children,
}: PayButtonProps) {
  const { wallet } = useCandela();
  const { pay, state } = usePay();
  const busy =
    state.phase === "building" ||
    state.phase === "signing" ||
    state.phase === "submitting";

  async function go() {
    try {
      const res = await pay({ to, amount, asset, memo });
      onPaid?.(res.hash);
    } catch {
      // surfaced via state.failed below
    }
  }

  const label =
    state.phase === "building" ? "Preparing…"
    : state.phase === "signing" ? "Touch your passkey…"
    : state.phase === "submitting" ? "Submitting — fees sponsored…"
    : state.phase === "confirmed" ? "Paid ✓"
    : children ?? (amount ? `Pay ${amount}` : "Pay");

  return (
    <span data-candela="pay" data-pay-phase={state.phase}>
      <button
        type="button"
        className={className}
        disabled={!wallet || busy || state.phase === "confirmed"}
        onClick={go}
      >
        {label}
      </button>
      {state.phase === "failed" && (
        <span role="alert" data-candela="error">{state.error}</span>
      )}
    </span>
  );
}
```

- [ ] **Step 7: Export from `src/index.ts`**

Append:

```ts
export { usePay, type PayState } from "./react/usePay";
export { useBalance } from "./react/useBalance";
export { PayButton } from "./react/PayButton";
```

- [ ] **Step 8: Run tests + typecheck + build**

Run: `pnpm --filter candela-kit test` → PASS (fix any harness drift against the real
use-submit test idioms — the intent of each assertion must survive).
Run: `pnpm --filter candela-kit typecheck` → exit 0.
Run: `pnpm --filter candela-kit build` → clean.

- [ ] **Step 9: Commit**

```powershell
git add packages/candela-kit/src packages/candela-kit/tests
git commit -m "feat(candela-kit): usePay, useBalance, PayButton react surface"
```

---

### Task 6: Sponsor guard — third allowlist kind `"pay"`

**Files:**
- Modify: `apps/probatum/src/lib/sponsor.ts`
- Test: `apps/probatum/src/lib/__tests__/sponsor.test.ts` (extend)

**Interfaces:**
- Consumes: existing `validateSubmission`, `isClaim`, `sponsorTransaction`, `AllowedSubmission` in `sponsor.ts`.
- Produces: `AllowedSubmission.kind` union gains `"pay"`; new export `nativeSacContractId(): string`. Task 7's faucet and Task 11's e2e depend on the guard accepting the wallet-signed SAC transfer that candela-kit's `pay()` submits via `/api/candela/submit`.

**Behavioral note (deliberate):** `isClaim` currently REJECTS when contract/function
don't match. That blocks any third kind from ever being tried. Change that one check to
`return false` (fall through to `isPay`, then to the default rejection). The two existing
"arbitrary function"/"arbitrary contract" tests still pass because the default rejection
message also matches `/not allowed/i`.

- [ ] **Step 1: Write the failing tests**

Extend `sponsor.test.ts`. Add after the existing helpers (reuse `recipient`, `sponsorSource`):

```ts
import { Asset } from "@stellar/stellar-base"; // merge into the existing import
import { nativeSacContractId } from "../sponsor"; // merge into the existing import

const NATIVE_SAC = Asset.native().contractId(NETWORK_PASSPHRASE);
const payer = recipient; // a C-address smart wallet

function payOperation(options: {
  contractId?: string;
  functionName?: string;
  authAddress?: string;
  includeAuth?: boolean;
  argCount?: number;
  rootContractId?: string;
  rootFunctionName?: string;
} = {}) {
  const contractId = options.contractId ?? NATIVE_SAC;
  const functionName = options.functionName ?? "transfer";
  const to = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
  const baseArgs = [
    new Address(payer).toScVal(),
    new Address(to).toScVal(),
    nativeToScVal(10_000_000n, { type: "i128" }),
  ];
  const args = baseArgs.slice(0, options.argCount ?? 3);
  while (args.length < (options.argCount ?? 3)) args.push(nativeToScVal(1n, { type: "i128" }));
  const auth = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(options.authAddress ?? payer).toScAddress(),
        nonce: xdr.Int64.fromString("1"),
        signatureExpirationLedger: 99,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(options.rootContractId ?? contractId).toScAddress(),
          functionName: options.rootFunctionName ?? functionName,
          args: baseArgs,
        }),
      ),
      subInvocations: [],
    }),
  });
  return Operation.invokeContractFunction({
    contract: contractId,
    function: functionName,
    args,
    auth: options.includeAuth === false ? [] : [auth],
  });
}

function buildPay(options: { source?: string; fee?: string; operation?: ReturnType<typeof payOperation> } = {}) {
  return new TransactionBuilder(new Account(options.source ?? sponsorSource, "1"), {
    fee: options.fee ?? "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(options.operation ?? payOperation())
    .setTimeout(30)
    .build();
}

describe("validateSubmission — pay", () => {
  it("exports the derived native SAC id", () => {
    expect(nativeSacContractId()).toBe(NATIVE_SAC);
    expect(nativeSacContractId()).toMatch(/^C[A-Z2-7]{55}$/);
  });

  it("accepts a wallet-authorized native SAC transfer", () => {
    expect(validateSubmission(buildPay().toXDR()).kind).toBe("pay");
  });

  it.each([
    ["a transfer on a non-native contract", buildPay({ operation: payOperation({ contractId: deployment.contractId, rootContractId: deployment.contractId }) }).toXDR(), /not allowed/i],
    ["a non-transfer SAC function", buildPay({ operation: payOperation({ functionName: "burn", rootFunctionName: "burn" }) }).toXDR(), /not allowed/i],
    ["a transfer with the wrong arg count", buildPay({ operation: payOperation({ argCount: 4 }) }).toXDR(), /malformed/i],
    ["a transfer without wallet auth", buildPay({ operation: payOperation({ includeAuth: false }) }).toXDR(), /authorization/i],
    ["auth address ≠ sender", buildPay({ operation: payOperation({ authAddress: deployment.contractId }) }).toXDR(), /does not match/i],
    ["auth root pinned to another function", buildPay({ operation: payOperation({ rootFunctionName: "burn" }) }).toXDR(), /root/i],
    ["a wrong source account", buildPay({ source: walletSource }).toXDR(), /not allowed/i],
  ])("rejects %s", (_label, transaction, message) => {
    expect(() => validateSubmission(transaction as string)).toThrow(message as RegExp);
  });

  it("rejects a pay transaction pre-signed by its source", () => {
    const tx = buildPay();
    tx.sign(Keypair.random()); // any envelope signature must be refused
    expect(() => validateSubmission(tx.toXDR())).toThrow(/unsigned/i);
  });
});
```

(The "auth address ≠ sender" row reuses `deployment.contractId` as an arbitrary
other C-address — the point is only that `authAddress` differs from `payer`.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter probatum-web test -- sponsor`
Expected: FAIL — `nativeSacContractId` not exported; accept case throws.

- [ ] **Step 3: Implement in `sponsor.ts`**

1. Add `Asset` to the `@stellar/stellar-base` import.
2. Add the export near `NETWORK_PASSPHRASE`:

```ts
export function nativeSacContractId(): string {
  return Asset.native().contractId(NETWORK_PASSPHRASE);
}
```

3. Widen the union: `kind: "wallet-deploy" | "claim" | "pay"`.
4. In `isClaim`, replace the mismatch rejection with fall-through:

```ts
  if (contractId !== deployment.contractId || functionName !== "claim") {
    return false;
  }
```

5. Add `isPay` (mirror `isClaim`'s strictness):

```ts
function isPay(transaction: Transaction, operation: StellarOperation): boolean {
  if (transaction.source !== deployment.adminPublic || operation.type !== "invokeHostFunction") return false;
  const func = operation.func;
  if (func.switch().name !== "hostFunctionTypeInvokeContract") return false;
  const invocation = func.invokeContract();
  const contractId = Address.fromScAddress(invocation.contractAddress()).toString();
  const functionName = invocation.functionName().toString();
  if (contractId !== nativeSacContractId() || functionName !== "transfer") return false;
  if (invocation.args().length !== 3) reject("transfer arguments are malformed");
  if (operation.auth?.length !== 1) reject("one wallet authorization is required");
  const authorization = operation.auth[0];
  if (authorization.credentials().switch().name !== "sorobanCredentialsAddress") {
    reject("wallet address authorization is required");
  }
  const authorizedAddress = Address.fromScAddress(
    authorization.credentials().address().address(),
  ).toString();
  const sender = Address.fromScVal(invocation.args()[0]).toString();
  if (authorizedAddress !== sender) reject("wallet authorization does not match sender");
  const rootFunction = authorization.rootInvocation().function();
  if (rootFunction.switch().name !== "sorobanAuthorizedFunctionTypeContractFn") {
    reject("wallet authorization root is not allowed");
  }
  const authorizedCall = rootFunction.contractFn();
  if (
    Address.fromScAddress(authorizedCall.contractAddress()).toString() !== nativeSacContractId() ||
    authorizedCall.functionName().toString() !== "transfer"
  ) {
    reject("wallet authorization root is not allowed");
  }
  if (transaction.signatures.length !== 0) reject("pay transaction must be unsigned by its source");
  return true;
}
```

6. Register it in `validateSubmission` (order matters — after `isClaim`):

```ts
  if (isWalletDeployment(transaction, operation)) return { kind: "wallet-deploy", transaction };
  if (isClaim(transaction, operation)) return { kind: "claim", transaction };
  if (isPay(transaction, operation)) return { kind: "pay", transaction };
  reject("transaction source or operation is not allowed");
```

7. In `sponsorTransaction`, treat `"pay"` like `"claim"` (sponsor IS the tx source):

```ts
  if (allowed.kind === "claim" || allowed.kind === "pay") {
    allowed.transaction.sign(sponsor);
    return allowed.transaction;
  }
```

Why no amount cap: the sponsor pays FEES only (bounded by `MAX_INNER_FEE`); the
transferred value comes from the wallet's own balance, which on testnet is faucet play
money. Note this in a comment on `isPay`.

- [ ] **Step 4: Run the full sponsor + handler suites**

Run: `pnpm --filter probatum-web test`
Expected: ALL PASS — including every pre-existing sponsor/handler test (the two
message-relaxed rows must still pass via the default rejection).

- [ ] **Step 5: Commit**

```powershell
git add apps/probatum/src/lib/sponsor.ts apps/probatum/src/lib/__tests__/sponsor.test.ts
git commit -m "feat(probatum-web): sponsor guard accepts wallet-authorized native SAC transfers"
```

---

### Task 7: Demo faucet — `/api/candela/fund`

**Files:**
- Modify: `apps/probatum/src/lib/sponsor.ts` (export `waitForSuccess`)
- Create: `apps/probatum/src/lib/faucet.ts`
- Create: `apps/probatum/src/app/api/candela/fund/handler.ts`
- Create: `apps/probatum/src/app/api/candela/fund/route.ts`
- Test: `apps/probatum/src/lib/__tests__/faucet.test.ts`, `apps/probatum/src/app/api/candela/fund/route.test.ts`

**Interfaces:**
- Consumes: `nativeSacContractId`, `NETWORK_PASSPHRASE`, `RPC_URL`, `waitForSuccess` from `sponsor.ts`; `SIM_SOURCE` from `chain.ts`; origin/body-guard idioms from `api/candela/submit/handler.ts` (read it and mirror exactly).
- Produces: `POST /api/candela/fund` with JSON `{ account: "C..." }` → `{ hash, status: "SUCCESS" }` | 400 (`FaucetValidationError`) | 429 (rate limit) | 500. Exports: `fundWallet(account: string, secret?): Promise<{hash: string; status: "SUCCESS"}>`, `FaucetValidationError`, `rateLimitOk(key: string, now?: number): boolean`, `FUND_AMOUNT_STROOPS = 100_000_000n` (10 XLM), `FUND_THRESHOLD_STROOPS = 10_000_000n` (1 XLM). Tasks 8/9/11 call the endpoint from the browser.

- [ ] **Step 1: Export `waitForSuccess` from sponsor.ts** — change `async function waitForSuccess` to `export async function waitForSuccess`. Run `pnpm --filter probatum-web test` → still green.

- [ ] **Step 2: Write the failing tests**

Create `apps/probatum/src/lib/__tests__/faucet.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  FUND_AMOUNT_STROOPS,
  FUND_THRESHOLD_STROOPS,
  FaucetValidationError,
  fundWallet,
  rateLimitOk,
} from "../faucet";

describe("faucet constants", () => {
  it("funds 10 XLM and refuses above 1 XLM", () => {
    expect(FUND_AMOUNT_STROOPS).toBe(100_000_000n);
    expect(FUND_THRESHOLD_STROOPS).toBe(10_000_000n);
  });
});

describe("fundWallet validation (no network)", () => {
  it("rejects a classic G address", async () => {
    await expect(
      fundWallet("GAT3GZE2HZ4CRHMSWI2CFART4DBCSXNSFBX7Z2NOJLNEUF5U37ZDRFBY", "S".repeat(56)),
    ).rejects.toThrow(FaucetValidationError);
  });
  it("rejects junk", async () => {
    await expect(fundWallet("hello", "S".repeat(56))).rejects.toThrow(FaucetValidationError);
  });
  it("requires a configured sponsor", async () => {
    await expect(
      fundWallet("CC7MQBZ2WOXGLOMX5MDZ4IXT5WHEII7SUK6LMXXKUKOGLARDGG66AOJL", undefined),
    ).rejects.toThrow(/sponsor/i);
  });
});

describe("rateLimitOk", () => {
  it("allows five hits per window then blocks, and resets", () => {
    const key = `test-${Math.random()}`;
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(rateLimitOk(key, t0)).toBe(true);
    expect(rateLimitOk(key, t0)).toBe(false);
    expect(rateLimitOk(key, t0 + 61 * 60 * 1000)).toBe(true);
  });
});
```

Create `apps/probatum/src/app/api/candela/fund/route.test.ts` — READ
`apps/probatum/src/app/api/candela/submit/route.test.ts` first and mirror its harness
(origin header setup, JSON body building). Cover: non-same-origin → 403; non-JSON → 415;
missing/`typeof !== "string"` account → 400; `FaucetValidationError` from injected fund →
400 with `{ error: "Wallet is not eligible for demo funds." }`; injected fund success →
200 `{ hash, status }`; rate-limited key → 429. Inject `fund` and `limiter` via the
handler's DI parameters (same pattern as `handleSubmit(request, submit)`).

- [ ] **Step 3: Run to verify failure** — `pnpm --filter probatum-web test -- faucet` → module-not-found FAIL.

- [ ] **Step 4: Implement `src/lib/faucet.ts`**

```ts
import "server-only";

import {
  Account,
  Address,
  Contract,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";
import {
  NETWORK_PASSPHRASE,
  RPC_URL,
  nativeSacContractId,
  waitForSuccess,
} from "./sponsor";
import { SIM_SOURCE } from "./chain";

/** 10 test XLM per fresh wallet; refuse when the wallet already holds ≥ 1 XLM. */
export const FUND_AMOUNT_STROOPS = 100_000_000n;
export const FUND_THRESHOLD_STROOPS = 10_000_000n;

export class FaucetValidationError extends Error {}

// Best-effort in-memory limiter (per process). The real abuse brake is the
// balance threshold: a wallet cannot be re-funded until it has spent.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimitOk(key: string, now = Date.now()): boolean {
  const entry = hits.get(key);
  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}

async function xlmBalance(server: rpc.Server, account: string): Promise<bigint> {
  const contract = new Contract(nativeSacContractId());
  const tx = new TransactionBuilder(new Account(SIM_SOURCE, "0"), {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call("balance", new Address(account).toScVal()))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
    throw new Error("balance simulation failed");
  }
  return BigInt(scValToNative(sim.result.retval));
}

export async function fundWallet(
  account: string,
  secret = process.env.PROBATUM_SPONSOR_SECRET,
): Promise<{ hash: string; status: "SUCCESS" }> {
  if (!StrKey.isValidContract(account)) {
    throw new FaucetValidationError("a smart-wallet C address is required");
  }
  if (!secret) throw new Error("sponsor is not configured");
  let sponsor: Keypair;
  try {
    sponsor = Keypair.fromSecret(secret);
  } catch {
    throw new Error("sponsor configuration is invalid");
  }
  const server = new rpc.Server(RPC_URL);
  if ((await xlmBalance(server, account)) >= FUND_THRESHOLD_STROOPS) {
    throw new FaucetValidationError("wallet already has demo funds");
  }
  const source = await server.getAccount(sponsor.publicKey());
  const tx = new TransactionBuilder(source, {
    fee: "1000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: nativeSacContractId(),
        function: "transfer",
        args: [
          new Address(sponsor.publicKey()).toScVal(),
          new Address(account).toScVal(),
          nativeToScVal(FUND_AMOUNT_STROOPS, { type: "i128" }),
        ],
      }),
    )
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error("faucet simulation failed");
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(sponsor);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error("faucet transaction was rejected");
  await waitForSuccess(server, sent.hash);
  return { hash: sent.hash, status: "SUCCESS" };
}
```

Ordering note: `StrKey`/`secret` checks run before any network call, so the two
validation tests pass without touching testnet. The `"requires a configured sponsor"`
test passes `undefined` explicitly — write the check as shown (throws before RPC).
The G-address test must hit `FaucetValidationError` BEFORE the secret parse — keep the
checks in the order shown.

- [ ] **Step 5: Implement handler + route**

`apps/probatum/src/app/api/candela/fund/handler.ts` — mirror `submit/handler.ts`'s guard
sequence exactly (origin, sec-fetch-site, content-type, body size), then:

```ts
import { FaucetValidationError, fundWallet, rateLimitOk } from "../../../../lib/faucet";

type Fund = typeof fundWallet;
type Limiter = typeof rateLimitOk;

export async function handleFund(
  request: Request,
  fund: Fund = fundWallet,
  limiter: Limiter = rateLimitOk,
): Promise<Response> {
  // ... same origin/content-type/size guards as handleSubmit (copy them) ...
  // parse { account } instead of { transaction }:
  if (typeof account !== "string") return json({ error: "Account is required." }, 400);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!limiter(ip)) return json({ error: "Too many requests." }, 429);
  try {
    return json(await fund(account), 200);
  } catch (error) {
    if (error instanceof FaucetValidationError) {
      return json({ error: "Wallet is not eligible for demo funds." }, 400);
    }
    return json({ error: "Demo funding is unavailable." }, 500);
  }
}
```

(“copy them” means literally reproduce the guard code from `handleSubmit` with the same
constants — the reviewer will diff them side by side.)

`route.ts` mirrors `submit/route.ts` (read it; it is a one-liner wiring POST → handler).

- [ ] **Step 6: Run tests** — `pnpm --filter probatum-web test` → ALL PASS. Also `pnpm --filter probatum-web exec tsc --noEmit` → exit 0.

- [ ] **Step 7: Commit**

```powershell
git add apps/probatum/src/lib/faucet.ts apps/probatum/src/lib/__tests__/faucet.test.ts apps/probatum/src/app/api/candela/fund apps/probatum/src/lib/sponsor.ts
git commit -m "feat(probatum-web): demo faucet endpoint with balance-threshold guard"
```

---

### Task 8: `/pay` playground page

**Files:**
- Modify: `apps/probatum/src/lib/site.ts` + `apps/probatum/src/lib/__tests__/site.test.ts`
- Modify: `apps/probatum/src/components/CandelaClaimProvider.tsx` (add `sourceAccount`)
- Create: `apps/probatum/src/app/pay/page.tsx`
- Create: `apps/probatum/src/app/pay/PayPlayground.tsx`

**Interfaces:**
- Consumes: kit exports `SignUpButton, SignInButton, useWallet, useBalance, encodePayRequest` (Tasks 3–5); `deployment.adminPublic`; `qrcode` (`QRCode.toDataURL` — works in the browser); Candela CSS classes (`glass-card`, `pill-metal`, `fade-title`, color tokens) already in `apps/probatum/src/app/globals.css`.
- Produces: `payUrl(code: string, origin?: string): string` in `site.ts` (Task 9's OG/meta and Task 11's e2e use it); the playground page at `/pay`; `data-*` hooks for e2e: `data-wallet-id` on the wallet card, `data-balance` (formatted string) on the balance readout, a `Get 10 test XLM` button, `data-demo-pay` on the tip link.

- [ ] **Step 1: TDD the `payUrl` helper**

Add to `site.test.ts` (read the file, follow its style):

```ts
it("builds pay URLs from a code", () => {
  expect(payUrl("abc-123", "https://candela.dev")).toBe("https://candela.dev/pay/abc-123");
  expect(payUrl("abc")).toBe("https://candela.dev/pay/abc");
});
```

Run `pnpm --filter probatum-web test -- site` → FAIL. Implement in `site.ts`:

```ts
export function payUrl(code: string, origin = siteOrigin()): string {
  // codes are base64url — already URL-safe, embed verbatim so decode matches
  return new URL(`/pay/${code}`, siteOrigin(origin)).toString();
}
```

Run again → PASS.

- [ ] **Step 2: Pass `sourceAccount` through the shared provider**

`CandelaClaimProvider.tsx` becomes:

```tsx
"use client";

import { CandelaProvider } from "candela-kit";
import type { ReactNode } from "react";
import deployment from "../../../../deployments/testnet.json";

export default function CandelaClaimProvider({ children }: { children: ReactNode }) {
  return (
    <CandelaProvider
      network="testnet"
      submissionUrl="/api/candela/submit"
      sourceAccount={deployment.adminPublic}
      storageKey="probatum:testnet:wallet"
    >
      {children}
    </CandelaProvider>
  );
}
```

The shared `storageKey` is deliberate: one passkey wallet identity per browser across
claim and pay — a wallet created on `/verify` works on `/pay` and vice versa.

- [ ] **Step 3: Build the page + island**

`apps/probatum/src/app/pay/page.tsx` (server component):

```tsx
import type { Metadata } from "next";
import PayPlayground from "./PayPlayground";

export const metadata: Metadata = {
  title: "Candela Pay — payments with a fingerprint",
  description:
    "Create a Stellar smart wallet with a passkey, get test XLM, and send a sponsored payment. No seed phrase, no extension, no gas.",
};

export default function PayPage() {
  return <PayPlayground />;
}
```

`apps/probatum/src/app/pay/PayPlayground.tsx` (client island). Structure — implementer
writes the JSX following the visual idioms of `ClaimPanel.tsx` (kickers, `pill-metal`
buttons, `glass-card` surfaces, `text-ash` copy) on a dark full-page section:

```tsx
"use client";

import { encodePayRequest, useBalance, useWallet, SignInButton, SignUpButton } from "candela-kit";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import deployment from "../../../../deployments/testnet.json";
import CandelaClaimProvider from "../../components/CandelaClaimProvider";

const TIP_REQUEST = { to: deployment.adminPublic, amount: "1", memo: "Tip the builder" };

function Playground() {
  const { wallet, isConnected, isHydrated, disconnect } = useWallet();
  const { balance, loading, refresh } = useBalance();
  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const [amount, setAmount] = useState("5");
  const [memo, setMemo] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  const tipCode = useMemo(() => encodePayRequest(TIP_REQUEST), []);
  const requestCode = useMemo(() => {
    if (!wallet || !/^\d+(?:\.\d+)?$/.test(amount)) return null;
    try {
      return encodePayRequest({ to: wallet.contractId, amount, ...(memo ? { memo } : {}) });
    } catch {
      return null;
    }
  }, [wallet, amount, memo]);
  const requestLink = requestCode ? `${window.location.origin}/pay/${requestCode}` : null;

  useEffect(() => {
    let live = true;
    if (!requestLink) { setQr(null); return; }
    QRCode.toDataURL(requestLink, {
      errorCorrectionLevel: "M", margin: 2, width: 240,
      color: { dark: "#000000", light: "#ffffff" },
    }).then((url) => { if (live) setQr(url); });
    return () => { live = false; };
  }, [requestLink]);

  async function fund() {
    if (!wallet || funding) return;
    setFunding(true);
    setFundError(null);
    try {
      const res = await fetch("/api/candela/fund", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: wallet.contractId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "funding failed");
      await refresh();
    } catch (e) {
      setFundError(e instanceof Error ? e.message : String(e));
    } finally {
      setFunding(false);
    }
  }

  // JSX: (1) header block — kicker "CANDELA PAY", fade-title headline
  // "Payments with a fingerprint.", one-line body, testnet badge;
  // (2) wallet card — restoring gate on !isHydrated; SignUpButton
  // ("Create passkey wallet") + SignInButton when !isConnected; else
  // data-wallet-id={wallet.contractId}, short address, disconnect,
  // balance readout <span data-balance>{loading ? "…" : balance?.formatted ?? "0"}</span>
  // suffixed " XLM", and a `Get 10 test XLM` pill-metal button wired to
  // fund() with {fundError && <p role="alert">{fundError}</p>};
  // (3) request card — amount + memo inputs (monochrome, font-mono),
  // the generated link with a copy button (navigator.clipboard.writeText +
  // "copied ✓" flip, same behavior as apps/candela CopyButton), and
  // {qr && <img src={qr} alt="Payment request QR" width={240} height={240} />};
  // (4) demo card — <a data-demo-pay href={`/pay/${tipCode}`}>Try it: tip the
  // builder 1 XLM →</a> plus the SEP-7 line rendered as mono text;
  // (5) caveat line: "Stellar testnet. Test XLM has no monetary value."
  return /* ... */;
}

export default function PayPlayground() {
  return (
    <CandelaClaimProvider>
      <main className="min-h-screen bg-vault text-vellum">
        <Playground />
      </main>
    </CandelaClaimProvider>
  );
}
```

The JSX comment block above is the binding content contract — every element listed
(including each `data-*` attribute) must exist. Copy visual treatments from
`ClaimPanel.tsx` and the `/probatum` page rather than inventing new ones. A "← Candela"
back link to `/` goes at the top. All text left in the monochrome system; no new fonts,
no new colors.

- [ ] **Step 4: Verify in the browser**

Stop any server holding :3000 first (`Get-NetTCPConnection -LocalPort 3000`).
Run: `pnpm --filter probatum-web dev`
Then with Playwright/headless or manual: open `http://localhost:3000/pay` —
page renders wallet card + demo card, zero console errors, 375px width has no horizontal
scroll. (Wallet creation needs a real/virtual authenticator — full flow is Task 11's e2e;
here verify rendering and the signed-out state.)

- [ ] **Step 5: Unit tests still green + typecheck**

Run: `pnpm --filter probatum-web test` → PASS. `pnpm --filter probatum-web exec tsc --noEmit` → exit 0.

- [ ] **Step 6: Commit**

```powershell
git add apps/probatum/src/lib/site.ts apps/probatum/src/lib/__tests__/site.test.ts apps/probatum/src/components/CandelaClaimProvider.tsx apps/probatum/src/app/pay
git commit -m "feat(probatum-web): Candela Pay playground at /pay"
```

---

### Task 9: `/pay/[code]` payer page + OG image

**Files:**
- Create: `apps/probatum/src/app/pay/[code]/page.tsx`
- Create: `apps/probatum/src/app/pay/[code]/PayPanel.tsx`
- Create: `apps/probatum/src/app/pay/[code]/opengraph-image.tsx`

**Interfaces:**
- Consumes: `decodePayRequest`, `PayRequest`, `PayButton`, `useWallet`, `useBalance` from candela-kit; `CandelaClaimProvider`; fund endpoint from Task 7; `payUrl` from Task 8.
- Produces: public payer page; e2e hooks: `data-pay-request` on the request card, `data-pay-hash={hash}` on the confirmed explorer link, the `Get 10 test XLM` button reused here.

- [ ] **Step 1: Server page with decode + metadata**

`page.tsx`:

```tsx
import type { Metadata } from "next";
import { decodePayRequest, type PayRequest } from "candela-kit";
import PayPanel from "./PayPanel";

function safeDecode(code: string): PayRequest | null {
  try {
    return decodePayRequest(code);
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ code: string }> },
): Promise<Metadata> {
  const { code } = await params;
  const request = safeDecode(code);
  if (!request) return { title: "Invalid payment link — Candela Pay" };
  const amount = request.amount ? `${request.amount} XLM` : "any amount";
  return {
    title: `Pay ${amount} with a fingerprint — Candela`,
    description:
      "A sponsored Stellar payment request. Sign with your device passkey — no seed phrase, no extension, no gas.",
  };
}

export default async function PayCodePage(
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const request = safeDecode(code);
  if (!request) {
    return (
      <main className="grid min-h-screen place-items-center bg-vault px-4 text-vellum">
        <div className="glass-card max-w-md p-8 text-center">
          <h1 className="text-2xl font-semibold">Invalid payment link</h1>
          <p className="mt-3 text-sm text-ash">
            This code doesn't decode to a payment request. Ask the sender for a fresh link.
          </p>
          <a className="pill-metal mt-6 inline-block" href="/pay">Open Candela Pay</a>
        </div>
      </main>
    );
  }
  return <PayPanel request={request} />;
}
```

- [ ] **Step 2: The client panel**

`PayPanel.tsx` — same island pattern as Task 8 (provider wrapper + inner component).
Binding content contract:

```tsx
"use client";

import { PayButton, useBalance, useWallet, SignInButton, SignUpButton, type PayRequest } from "candela-kit";
import { useState } from "react";
import CandelaClaimProvider from "../../../components/CandelaClaimProvider";

function short(value: string, start = 10, end = 8) {
  return value.length > start + end + 1 ? `${value.slice(0, start)}…${value.slice(-end)}` : value;
}

function Panel({ request }: { request: PayRequest }) {
  const { wallet, isConnected, isHydrated } = useWallet();
  const { balance, refresh } = useBalance();
  const [paidHash, setPaidHash] = useState<string | null>(null);
  // ... fund() identical to Task 8's (extract nothing — 12 lines, duplication
  // is fine at this count and keeps the islands independent) ...

  // JSX contract:
  // (1) request card data-pay-request: kicker "PAYMENT REQUEST", the amount
  //     huge (font-mono), "to {short(request.to)}", the memo if present,
  //     "Fees sponsored · Stellar testnet" line.
  // (2) !isHydrated → restoring gate; !isConnected → SignUpButton
  //     ("Create passkey wallet") + SignInButton, same copy idioms as ClaimPanel.
  // (3) connected → balance line (data-balance + " XLM"), `Get 10 test XLM`
  //     button when balance?.raw === 0n, and:
  //     <PayButton to={request.to} amount={request.amount} asset={request.asset}
  //       memo={request.memo} className="pill-metal claim-primary"
  //       onPaid={(hash) => { setPaidHash(hash); void refresh(); }} />
  // (4) paidHash → <a data-pay-hash={paidHash}
  //       href={`https://stellar.expert/explorer/testnet/tx/${paidHash}`}
  //       target="_blank" rel="noreferrer">View confirmed transaction ↗</a>
  // (5) caveat: "Payments move test XLM on the Stellar testnet. No monetary value."
  return /* ... */;
}

export default function PayPanel({ request }: { request: PayRequest }) {
  return (
    <CandelaClaimProvider>
      <main className="min-h-screen bg-vault text-vellum">
        <Panel request={request} />
      </main>
    </CandelaClaimProvider>
  );
}
```

Note: when `request.amount` is absent, render an amount input above the PayButton and
pass the typed value as `amount` — validate with the same `/^\d+(?:\.\d+)?$/` gate as
Task 8 before enabling the button.

- [ ] **Step 3: OG image**

`opengraph-image.tsx` — model directly on `apps/probatum/src/app/verify/[id]/opengraph-image.tsx`
(same runtime/size/contentType exports, same black radial background). Content: top row
"Candela" with the wax-dot mark (reuse the circle+diamond div trick, background `#a91f3d`)
and right-aligned "STELLAR TESTNET · SPONSORED PAYMENT"; middle: "PAYMENT REQUEST" kicker,
the amount (e.g. `1 XLM`) at ~120px `fontWeight: 700`, "to <short(to)>" beneath, memo line
when present; bottom row: "Pay with a fingerprint — no seed phrase, no gas" | "candela.dev".
Decode with the same `safeDecode`; on null render "Invalid payment link" as the middle text.

- [ ] **Step 4: Browser verify**

With the dev server: open a real code URL — generate one in node:

```powershell
node -e "const {encodePayRequest}=require('./packages/candela-kit/dist/index.js');console.log(encodePayRequest({to:'GAT3GZE2HZ4CRHMSWI2CFART4DBCSXNSFBX7Z2NOJLNEUF5U37ZDRFBY',amount:'1',memo:'Tip the builder'}))"
```

(Requires `pnpm --filter candela-kit build` output to exist — run it if `dist/` is stale.)
Open `http://localhost:3000/pay/<code>` → request card renders amount/recipient/memo,
signed-out state shows the passkey buttons; `http://localhost:3000/pay/garbage` → the
invalid-link card; `/pay/<code>/opengraph-image` returns a PNG. Zero console errors, no
horizontal scroll at 375px.

- [ ] **Step 5: Tests + typecheck + commit**

`pnpm --filter probatum-web test` → PASS; `pnpm --filter probatum-web exec tsc --noEmit` → 0.

```powershell
git add apps/probatum/src/app/pay
git commit -m "feat(probatum-web): public /pay/[code] payer page with OG card"
```

---

### Task 10: Landing Payments section + nav + Tailwind source boundary

**Files:**
- Create: `apps/candela/src/components/Payments.tsx`
- Modify: `apps/candela/src/app/page.tsx`
- Modify: `apps/probatum/src/app/page.tsx`
- Modify: `apps/candela/src/components/NavPill.tsx`
- Modify: `apps/probatum/src/app/globals.css` (Tailwind `@source`)

**Interfaces:**
- Consumes: existing section idioms (`HowItWorks.tsx` is the model: `data-reveal`, `fade-title`, `glass-card`, `text-ash`/`text-parchment` tokens); the snippet MUST match the real kit API from Tasks 4–5.
- Produces: `<Payments />` section (`id="payments"`) rendered on both landing pages after How-it-works.

- [ ] **Step 1: Create `Payments.tsx`**

```tsx
const SNIPPET = [
  { code: `<CandelaProvider network="testnet">`, dim: false },
  { code: `  <SignUpButton />`, comment: "onboarding: solved" },
  { code: `  <PayButton to="G…" amount="25" />`, comment: "payments: solved" },
  { code: `</CandelaProvider>`, dim: false },
];

export default function Payments() {
  return (
    <section id="payments" className="relative mx-auto max-w-6xl px-4 py-28 md:px-6 md:py-36">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <p data-reveal className="font-mono text-xs tracking-[0.2em] text-ash">
            CANDELA PAY
          </p>
          <h2 data-reveal className="fade-title mt-3 text-4xl md:text-5xl">
            Onboarding and payments. Both solved.
          </h2>
          <p data-reveal className="mt-4 text-[15px] leading-relaxed text-ash">
            The same passkey that created the wallet signs the payment. Sponsored
            SAC transfers — XLM today, any Stellar asset by address, USDC included.
            No seed phrase, no extension, no gas. Three lines, end to end.
          </p>
          <div data-reveal className="mt-7 flex flex-wrap items-center gap-3">
            <a href="/pay" className="pill-metal">Try Candela Pay →</a>
            <a
              href="/pay"
              className="text-[13px] font-medium text-ash transition-colors hover:text-vellum"
            >
              or scan a payment QR on the demo
            </a>
          </div>
        </div>
        <div data-reveal data-reveal-delay="0.08" className="glass-card p-7">
          <p className="font-mono text-xs text-candle">payments.tsx</p>
          <div className="mt-4 space-y-1.5">
            {SNIPPET.map((line) => (
              <p
                key={line.code}
                className="break-all rounded-lg border border-vellum/8 bg-vault/60 px-3 py-2 font-mono text-[11px] text-parchment"
              >
                {line.code}
                {"comment" in line && line.comment && (
                  <span className="text-ash">{"  // "}{line.comment}</span>
                )}
              </p>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ash">
            Real API, not pseudocode — the live demo on this site runs exactly this.
          </p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render it on both pages**

`apps/candela/src/app/page.tsx`: `import Payments from "@/components/Payments";` and place
`<Payments />` between `<HowItWorks />` and `<UseCase stats={stats} />`.
`apps/probatum/src/app/page.tsx`: `import CandelaPayments from "../../../candela/src/components/Payments";`
and place `<CandelaPayments />` between `<CandelaHowItWorks />` and `<CandelaUseCase stats={stats} />`.

- [ ] **Step 3: Nav link**

In `apps/candela/src/components/NavPill.tsx`, add before the Probatum link:

```tsx
<a href="/pay" className="transition-colors hover:text-vellum">Payments</a>
```

(On the legacy :3001 standalone preview `/pay` 404s — acceptable; the deployed product is
the unified server. Do not add conditional logic for it.)

- [ ] **Step 4: Tailwind source boundary (trap §6.12)**

In `apps/probatum/src/app/globals.css`, directly under `@import "tailwindcss";`, add:

```css
@source "../../../candela/src";
```

Path check: `globals.css` lives at `apps/probatum/src/app/`, and
`apps/probatum/src/app/page.tsx` already imports Candela components via
`../../../candela/src/components/...` — the `@source` directive resolves from the same
depth, so the three-level form is correct. If the build warns the path doesn't exist,
re-verify against that import — do not silently drop the directive.

- [ ] **Step 5: Verify both builds + computed styles**

Stop any :3000/:3001 servers and delete no `.next` unless corrupted.
Run: `pnpm --filter candela-web test` → 7 PASS. `pnpm --filter candela-web build` → exit 0.
Run: `pnpm --filter probatum-web build` → exit 0, route list includes `/pay` and `/pay/[code]`.
Run: `pnpm --filter probatum-web start`, open `http://localhost:3000/` — the Payments
section renders between How-it-works and Use-case with correct spacing/typography (verify
a section-specific class like `tracking-[0.2em]` is actually applied via computed styles,
not just present in markup — that's the §6.12 check), reveals animate, reduced-motion
shows the complete frame, 375px has no horizontal scroll, zero console errors.

- [ ] **Step 6: Commit**

```powershell
git add apps/candela/src apps/probatum/src/app/page.tsx apps/probatum/src/app/globals.css
git commit -m "feat(web): landing Payments section with real three-line snippet"
```

---

### Task 11: Live e2e — create, fund, pay on testnet

**Files:**
- Create: `apps/probatum/tests/e2e/pay.spec.ts`

**Interfaces:**
- Consumes: everything shipped in Tasks 1–10; the CDP virtual-authenticator idiom and on-chain timeouts from `apps/probatum/tests/e2e/viral-loop.spec.ts` (read it first, reuse its patterns verbatim); the `data-*` hooks defined in Tasks 8–9.
- Produces: the recorded live proof of the full payment loop (wallet + fund tx + pay tx hashes go in the task report and ledger — they are public).

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from "@playwright/test";

test("Candela Pay: create wallet, faucet-fund, and pay the tip request on live testnet", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  page.on("console", (m) => console.log("[page]", m.text()));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));

  await page.goto("/pay");
  await page.getByRole("button", { name: "Create passkey wallet" }).click();
  const card = page.locator("[data-wallet-id]");
  await expect(card).toBeVisible({ timeout: 120_000 });
  const wallet = await card.getAttribute("data-wallet-id");
  expect(wallet).toMatch(/^C[A-Z2-7]{55}$/);

  // Fresh wallet starts empty, then the faucet lands 10 test XLM.
  await expect(page.locator("[data-balance]")).toHaveText("0", { timeout: 60_000 });
  await page.getByRole("button", { name: "Get 10 test XLM" }).click();
  await expect(page.locator("[data-balance]")).toHaveText("10", { timeout: 120_000 });

  // Follow the tip request and pay it with the same (persisted) wallet.
  await page.locator("[data-demo-pay]").click();
  await expect(page.locator("[data-pay-request]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(`[data-wallet-id="${wallet}"]`).or(page.locator("[data-balance]"))).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: /^Pay 1$/ }).click();
  const confirmed = page.locator("[data-pay-hash]");
  await expect(confirmed).toBeVisible({ timeout: 120_000 });
  const hash = await confirmed.getAttribute("data-pay-hash");
  expect(hash).toMatch(/^[0-9a-f]{64}$/);
  console.log("PAY PROOF wallet:", wallet, "tx:", hash);

  // The balance visibly moved: 10 − 1 = 9 (fees sponsored, so exact).
  await expect(page.locator("[data-balance]")).toHaveText("9", { timeout: 60_000 });
});
```

Adjust selectors ONLY to match what Tasks 8–9 actually shipped (e.g. the pay button's
accessible name) — the assertions' intent is binding: fresh wallet → `0`, funded → `10`,
after paying 1 → exactly `9`, and a 64-hex on-chain hash.

- [ ] **Step 2: Build and run**

Stop anything on :3000. Then:

```powershell
pnpm --filter probatum-web build
pnpm --filter probatum-web e2e
```

(Playwright's webServer starts `pnpm start` itself; `apps/probatum/.env` supplies the
sponsor server-side.) Expected: BOTH specs pass — `viral-loop.spec.ts` must stay green
(if all demo certificates are consumed it self-reports "fresh demo seed required"; that
pre-existing condition is not caused by this task — report it, don't fix it here).
Record the printed wallet + tx hashes in the task report.

- [ ] **Step 3: Commit**

```powershell
git add apps/probatum/tests/e2e/pay.spec.ts
git commit -m "test(e2e): prove live create-fund-pay loop on testnet"
```

---

### Task 12: Final verification pass + docs

**Files:**
- Modify: `AGENTS.md` (current-state table, §9 work queue, snapshot section)
- Modify: `.superpowers/sdd/progress.md` (ledger — gitignored, still update it)

**Interfaces:** none — this is the evidence pass. No code changes unless a check fails
(then fix via the responsible task's owner-files and re-run).

- [ ] **Step 1: Full suite matrix** (stop all dev/prod servers first)

```powershell
pnpm --filter candela-kit test        # all unit suites incl. new pay/amount/codec/react
pnpm --filter candela-kit typecheck
pnpm --filter candela-kit build
pnpm --filter probatum-web test       # sponsor/faucet/site/handler + existing 43+
pnpm --filter probatum-web exec tsc --noEmit
pnpm --filter probatum-web build
pnpm --filter candela-web test
pnpm --filter candela-web build
```

Expected: every command exit 0. Record counts.

- [ ] **Step 2: Production browser matrix**

`pnpm --filter probatum-web start`, then verify (Playwright or manual, per prior plans):
`/` Payments section (reveal, reduced-motion full frame, computed styles); `/pay` and a
real `/pay/[code]` at 1440px and 375px (no horizontal scroll); `/pay/garbage` invalid
card; `/pay/<code>/opengraph-image` returns image/png; zero console errors everywhere;
nav "Payments" link works; copy on all new surfaces contains no fiat/custody/investment
language (read it, don't grep it).

- [ ] **Step 3: Guard regression probe**

With the prod server up, POST a deliberately-invalid submission to `/api/candela/submit`
(e.g. the Task 6 "burn" fixture XDR) → expect 400 "not eligible". POST a G-address to
`/api/candela/fund` → 400. This proves deny-by-default survived integration.

- [ ] **Step 4: Update docs + ledger**

- `AGENTS.md`: current-state row for payments (kit API + guard third kind + faucet +
  `/pay` surfaces), §9 queue prunes what shipped, snapshot section refreshed (date, latest
  commit, test counts, live proof hashes).
- `.superpowers/sdd/progress.md`: PLAN 5 block with per-task commits and the recorded
  wallet/tx hashes.

- [ ] **Step 5: Commit docs**

```powershell
git add AGENTS.md
git commit -m "docs: refresh handoff after Candela Payments (Plan 5)"
```

(`.superpowers/` is gitignored — the ledger update stays local by design.)
