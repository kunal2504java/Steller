import { beforeEach, describe, expect, it, vi } from "vitest";

// A fixed, test-only Stellar secret string — never used on any real network.
const TEST_SPONSOR_SECRET =
  "SAI55JONQ7GFQELII6SBD6UMYYQQBLA7DPC7RK3G7C2IAHD7YSRP3CGN";

// --- @stellar/stellar-base mock ------------------------------------------
// Pre-existing, unrelated environment issue: @noble/curves' ensureBytes()
// rejects the Buffer @stellar/stellar-base decodes a secret into when run
// under vitest's jsdom environment ("private key must be hex string or
// Uint8Array"), independent of this fix — reproduced with a standalone
// `Keypair.fromSecret(...)` call under the same jsdom config. Signing with
// the sponsor keypair is not part of the kit-state-hydration behavior this
// test targets, so it's stubbed out rather than worked around.
vi.mock("@stellar/stellar-base", () => ({
  Keypair: {
    fromSecret: (_secret: string) => ({ publicKey: () => "GFAKESPONSOR" }),
  },
  TransactionBuilder: {},
}));

// --- passkey-kit mock ---------------------------------------------------
// Mirrors the ONE behavior this task's fix depends on: `sign()` throws if
// `this.wallet` is unset, and `connectWallet()` is the only thing that sets
// it. We don't re-test passkey-kit's own logic (contract-id derivation,
// WebAuthn, etc.) — that's out of scope; this tests OUR wiring in wallet.ts.
const connectWalletMock = vi.fn();
const signMock = vi.fn();

vi.mock("passkey-kit", () => {
  class PasskeyKit {
    wallet: { options: { contractId: string } } | undefined;
    options: any;
    constructor(options: any) {
      this.options = options;
    }
    async connectWallet(opts?: { keyId?: string }) {
      connectWalletMock(opts);
      this.wallet = { options: { contractId: "CFAKECONTRACTID" } };
      return { contractId: "CFAKECONTRACTID", keyIdBase64: opts?.keyId ?? "fake-key-id" };
    }
    async createWallet() {
      throw new Error("not used by this test");
    }
    async sign(txn: any, opts?: unknown) {
      signMock(opts);
      if (this.wallet == null) {
        // Reproduces the real defect: passkey-kit's sign() unconditionally
        // reads `this.wallet!.options.contractId`.
        throw new TypeError("Cannot read properties of undefined (reading 'options')");
      }
      return txn;
    }
  }

  class PasskeyServer {
    constructor(_options: any) {}
    async send(_tx: any) {
      return { status: "SUCCESS" };
    }
  }

  return { PasskeyKit, PasskeyServer };
});

// --- @stellar/stellar-sdk/minimal/rpc mock -------------------------------
// simulate/assemble/send/getTransaction all return canned success shapes so
// signAndSubmit's post-sign submission path completes without a network.
vi.mock("@stellar/stellar-sdk/minimal/rpc", () => {
  class Server {
    constructor(_rpcUrl?: string) {}
    async simulateTransaction(_tx: any) {
      return { simulated: true };
    }
    async sendTransaction(_tx: any) {
      return { status: "PENDING", hash: "deadbeefcafe" };
    }
    async getTransaction(_hash: string) {
      return { status: "SUCCESS" };
    }
  }
  const Api = {
    isSimulationSuccess: (_sim: any) => true,
  };
  function assembleTransaction(_built: any, _sim: any) {
    return { build: () => ({ sign: (_kp: any) => {} }) };
  }
  return { Server, Api, assembleTransaction };
});

const { signAndSubmit } = await import("../../src/core/wallet");
const { resolveConfig } = await import("../../src/core/config");

describe("signAndSubmit — wallet-state hydration", () => {
  const cfg = {
    ...resolveConfig("testnet"),
    sponsorSecret: TEST_SPONSOR_SECRET,
  };
  const wallet = { contractId: "CFAKECONTRACTID", keyIdBase64: "fake-key-id" };
  const fakeAssembled = { built: {} };

  beforeEach(() => {
    connectWalletMock.mockClear();
    signMock.mockClear();
  });

  it("hydrates a fresh kit instance via connectWallet(keyId) and does not throw", async () => {
    const result = await signAndSubmit(cfg, wallet, fakeAssembled);

    expect(connectWalletMock).toHaveBeenCalledTimes(1);
    expect(connectWalletMock).toHaveBeenCalledWith(
      expect.objectContaining({ keyId: wallet.keyIdBase64 }),
    );
    expect(signMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ hash: "deadbeefcafe", status: "SUCCESS" });
  });

  it("reuses the memoized kit instance on a second call — no repeat connectWallet", async () => {
    const result = await signAndSubmit(cfg, wallet, fakeAssembled);

    expect(connectWalletMock).not.toHaveBeenCalled();
    expect(signMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ hash: "deadbeefcafe", status: "SUCCESS" });
  });

  it("re-hydrates on wallet identity mismatch — different contractId triggers connectWallet again", async () => {
    // First call hydrates the kit with wallet A
    await signAndSubmit(cfg, wallet, fakeAssembled);
    connectWalletMock.mockClear();
    signMock.mockClear();

    // Second call with a different wallet identity
    const walletB = {
      contractId: "CDIFFERENTCONTRACTID",
      keyIdBase64: "different-key-id",
    };
    const result = await signAndSubmit(cfg, walletB, fakeAssembled);

    // Identity mismatch detected, connectWallet called again with new keyId
    expect(connectWalletMock).toHaveBeenCalledTimes(1);
    expect(connectWalletMock).toHaveBeenCalledWith(
      expect.objectContaining({ keyId: walletB.keyIdBase64 }),
    );
    expect(signMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ hash: "deadbeefcafe", status: "SUCCESS" });
  });
});
