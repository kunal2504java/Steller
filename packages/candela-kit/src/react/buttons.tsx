"use client";
import { useState } from "react";
import { useCandela } from "./context";
import { canUsePasskeys } from "../core/passkeys";
import { createWallet, connectWallet, type CandelaWallet } from "../core/wallet";

type ButtonProps = {
  onWallet?: (w: CandelaWallet) => void;
  appName?: string;
  userName?: string;
  className?: string;
  children?: React.ReactNode;
};

function useFlow(
  onWallet: ButtonProps["onWallet"],
  run: () => Promise<CandelaWallet>,
) {
  const { setWallet } = useCandela();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    if (!canUsePasskeys()) {
      setError("Passkeys are not supported in this browser — open in Chrome or Safari.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const w = await run();
      setWallet(w);
      onWallet?.(w);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return { go, busy, error };
}

export function SignUpButton({
  onWallet,
  appName = "Candela",
  userName = "user",
  className,
  children,
}: ButtonProps) {
  const { config } = useCandela();
  const { go, busy, error } = useFlow(onWallet, () =>
    createWallet(config, appName, userName),
  );
  return (
    <span data-candela="signup">
      <button type="button" className={className} disabled={busy} onClick={go}>
        {busy ? "Creating wallet…" : (children ?? "Sign up with passkey")}
      </button>
      {error && <span role="alert" data-candela="error">{error}</span>}
    </span>
  );
}

export function SignInButton({ onWallet, className, children }: ButtonProps) {
  const { config } = useCandela();
  const { go, busy, error } = useFlow(onWallet, () => connectWallet(config));
  return (
    <span data-candela="signin">
      <button type="button" className={className} disabled={busy} onClick={go}>
        {busy ? "Connecting…" : (children ?? "Sign in with passkey")}
      </button>
      {error && <span role="alert" data-candela="error">{error}</span>}
    </span>
  );
}
