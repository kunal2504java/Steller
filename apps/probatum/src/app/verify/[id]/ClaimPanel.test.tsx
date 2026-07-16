import React, { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import demo from "../../../../../../fixtures/probatum-testnet-demo.json";

const kit = vi.hoisted(() => ({
  wallet: null as null | { contractId: string; keyIdBase64: string },
  isHydrated: true,
  state: { phase: "idle" } as
    | { phase: "idle" }
    | { phase: "signing" }
    | { phase: "submitting" }
    | { phase: "confirmed"; hash: string }
    | { phase: "failed"; error: string },
}));

vi.mock("candela-kit", () => ({
  resolveConfig: () => ({
    rpcUrl: "https://rpc.example",
    networkPassphrase: "Test Network",
  }),
  SignUpButton: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  SignInButton: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  useWallet: () => ({
    wallet: kit.wallet,
    isHydrated: kit.isHydrated,
    isConnected: kit.wallet !== null,
    disconnect: vi.fn(),
  }),
  useSubmit: () => ({ submit: vi.fn(), state: kit.state }),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import ClaimPanel from "./ClaimPanel";

const certificate = demo.certificates[0];

async function render(claimedBy: string | null = null) {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(
    <ClaimPanel
      envelope={certificate as never}
      leafHex={certificate.leaf}
      claimedBy={claimedBy}
    />,
  ));
  return { host, unmount: () => act(async () => root.unmount()) };
}

describe("ClaimPanel", () => {
  beforeEach(() => {
    kit.wallet = null;
    kit.isHydrated = true;
    kit.state = { phase: "idle" };
  });

  it("holds disconnected UI until wallet restoration completes", async () => {
    kit.isHydrated = false;
    const view = await render();
    expect(view.host.textContent).toContain("Restoring passkey wallet");
    expect(view.host.textContent).not.toContain("Create passkey wallet");
    await view.unmount();
  });

  it("offers the real signup and signin paths when disconnected", async () => {
    const view = await render();
    expect(view.host.textContent).toContain("Create passkey wallet");
    expect(view.host.textContent).toContain("Sign in instead");
    await view.unmount();
  });

  it("shows the authoritative existing claimant", async () => {
    const view = await render("CCLAIMEDWALLET");
    expect(view.host.textContent).toContain("Already claimed");
    expect(view.host.textContent).toContain("CCLAIMEDWALLET");
    expect(view.host.textContent).not.toContain("Create passkey wallet");
    await view.unmount();
  });

  it("surfaces an actionable submission failure", async () => {
    kit.wallet = { contractId: "CWALLET", keyIdBase64: "key" };
    kit.state = { phase: "failed", error: "RPC rejected transaction" };
    const view = await render();
    expect(view.host.textContent).toContain("Claim failed");
    expect(view.host.textContent).toContain("RPC rejected transaction");
    expect(view.host.textContent).toContain("Try claim again");
    await view.unmount();
  });

  it.each([
    ["signing", "Touch your passkey"],
    ["submitting", "Submitting — fees sponsored"],
  ] as const)("makes the %s phase observable", async (phase, label) => {
    kit.wallet = { contractId: "CWALLET", keyIdBase64: "key" };
    kit.state = { phase };
    const view = await render();
    expect(view.host.textContent).toContain(label);
    expect(view.host.querySelector("button[disabled]")).not.toBeNull();
    await view.unmount();
  });

  it("links the confirmed transaction", async () => {
    kit.wallet = { contractId: "CWALLET", keyIdBase64: "key" };
    kit.state = { phase: "confirmed", hash: "abc123" };
    const view = await render();
    const link = view.host.querySelector<HTMLAnchorElement>('a[href*="/tx/abc123"]');
    expect(view.host.textContent).toContain("Claim confirmed");
    expect(link?.textContent).toContain("View confirmed transaction");
    await view.unmount();
  });
});
