"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { resolveConfig, type CandelaConfig } from "../core/config";
import type { CandelaWallet } from "../core/wallet";

type Ctx = {
  config: CandelaConfig;
  wallet: CandelaWallet | null;
  setWallet: (w: CandelaWallet | null) => void;
  isHydrated: boolean;
};

const CandelaContext = createContext<Ctx | null>(null);

export function CandelaProvider({
  network,
  submissionUrl,
  storageKey,
  children,
}: {
  network: "testnet" | CandelaConfig;
  submissionUrl?: string;
  storageKey?: string;
  children: ReactNode;
}) {
  const config = useMemo(
    () => ({ ...resolveConfig(network), ...(submissionUrl ? { submissionUrl } : {}) }),
    [network, submissionUrl],
  );
  const networkIdentity = `${config.rpcUrl}|${config.networkPassphrase}|${config.walletWasmHash}`;
  const [wallet, setWalletState] = useState<CandelaWallet | null>(null);
  const [isHydrated, setHydrated] = useState(!storageKey);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const record = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (
        record?.v === 1 &&
        record.network === networkIdentity &&
        typeof record.wallet?.contractId === "string" &&
        typeof record.wallet?.keyIdBase64 === "string"
      ) {
        setWalletState(record.wallet);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      localStorage.removeItem(storageKey);
    } finally {
      setHydrated(true);
    }
  }, [networkIdentity, storageKey]);

  const setWallet = useCallback((next: CandelaWallet | null) => {
    setWalletState(next);
    if (!storageKey) return;
    if (next) {
      localStorage.setItem(storageKey, JSON.stringify({ v: 1, network: networkIdentity, wallet: next }));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [networkIdentity, storageKey]);

  const value = useMemo(
    () => ({ config, wallet, setWallet, isHydrated }),
    [config, wallet, setWallet, isHydrated],
  );
  return (
    <CandelaContext.Provider value={value}>
      {children}
    </CandelaContext.Provider>
  );
}

export function useCandela(): Ctx {
  const ctx = useContext(CandelaContext);
  if (!ctx) throw new Error("useCandela requires <CandelaProvider>");
  return ctx;
}
