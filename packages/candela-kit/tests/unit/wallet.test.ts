import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sign: vi.fn(),
  simulateTransaction: vi.fn(),
  isSimulationSuccess: vi.fn(),
  assembleTransaction: vi.fn(),
}));

vi.mock("passkey-kit", () => ({
  PasskeyKit: class {
    wallet = { options: { contractId: "CWALLET" } };
    sign = mocks.sign;
  },
  PasskeyServer: class {},
}));

vi.mock("@stellar/stellar-base", () => ({
  Keypair: {},
  TransactionBuilder: {},
}));

vi.mock("@stellar/stellar-sdk/minimal/rpc", () => ({
  Server: class {
    simulateTransaction = mocks.simulateTransaction;
  },
  Api: { isSimulationSuccess: mocks.isSimulationSuccess },
  assembleTransaction: mocks.assembleTransaction,
}));

const { signAndSubmit } = await import("../../src/core/wallet");

describe("signAndSubmit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSimulationSuccess.mockReturnValue(true);
    mocks.simulateTransaction.mockResolvedValue({ status: "SUCCESS" });
    mocks.assembleTransaction.mockReturnValue({
      build: () => ({ toXDR: () => "prepared-xdr" }),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hash: "abc123", status: "SUCCESS" }),
    }));
  });

  it("re-simulates the transaction object returned by PasskeyKit.sign", async () => {
    const originalBuilt = { toXDR: () => "unsigned-xdr" };
    const signedBuilt = { toXDR: () => "signed-xdr" };
    mocks.sign.mockResolvedValue({ built: signedBuilt });

    await signAndSubmit(
      {
        rpcUrl: "https://rpc.example",
        networkPassphrase: "test network",
        walletWasmHash: "wasm-hash",
        submissionUrl: "/api/candela/submit",
      },
      { contractId: "CWALLET", keyIdBase64: "credential" },
      { built: originalBuilt } as never,
    );

    expect(mocks.simulateTransaction).toHaveBeenCalledWith(signedBuilt);
  });
});
