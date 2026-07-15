import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CandelaProvider } from "../../src/react/context";
import { useWallet } from "../../src/react/useWallet";

describe("CandelaProvider wallet persistence", () => {
  it("restores a same-network wallet and disconnect removes it", async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const key = "candela:test:wallet";
    localStorage.setItem(key, JSON.stringify({
      v: 1,
      network: "https://soroban-testnet.stellar.org|Test SDF Network ; September 2015|ecd990f0b45ca6817149b6175f79b32efb442f35731985a084131e8265c4cd90",
      wallet: { contractId: "CRESTORED", keyIdBase64: "restored-key" },
    }));
    function Harness() {
      const { wallet, isHydrated, disconnect } = useWallet();
      return <button onClick={disconnect}>{isHydrated ? wallet?.contractId ?? "none" : "loading"}</button>;
    }
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(<CandelaProvider network="testnet" storageKey={key}><Harness /></CandelaProvider>));
    expect(host.textContent).toBe("CRESTORED");
    await act(async () => host.querySelector("button")!.click());
    expect(host.textContent).toBe("none");
    expect(localStorage.getItem(key)).toBeNull();
    await act(async () => root.unmount());
  });
});
