import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signAndSubmitMock = vi.fn();
vi.mock("../../src/core/wallet", () => ({ signAndSubmit: signAndSubmitMock }));
vi.mock("../../src/react/context", () => ({
  useCandela: () => ({
    config: { rpcUrl: "rpc", networkPassphrase: "network", walletWasmHash: "wasm" },
    wallet: { contractId: "CWALLET", keyIdBase64: "key" },
  }),
}));

const { useSubmit } = await import("../../src/react/useSubmit");

describe("useSubmit phases", () => {
  beforeEach(() => {
    signAndSubmitMock.mockReset();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("keeps signing observable until passkey signing completes", async () => {
    let markSigned!: () => void;
    let confirm!: () => void;
    signAndSubmitMock.mockImplementation((_cfg, _wallet, _assembled, options) =>
      new Promise((resolve) => {
        markSigned = options.onSigned;
        confirm = () => resolve({ hash: "abc123", status: "SUCCESS" });
      }),
    );
    function Harness() {
      const { submit, state } = useSubmit();
      return <button onClick={() => void submit({ built: {} } as never)}>{state.phase}</button>;
    }
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<Harness />));
    await act(async () => host.querySelector("button")!.click());
    expect(host.textContent).toBe("signing");
    await act(async () => markSigned());
    expect(host.textContent).toBe("submitting");
    await act(async () => confirm());
    expect(host.textContent).toBe("confirmed");
    await act(async () => root.unmount());
  });
});
