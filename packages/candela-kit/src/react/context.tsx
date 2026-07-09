"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { resolveConfig, type CandelaConfig } from "../core/config";
import type { CandelaWallet } from "../core/wallet";

type Ctx = {
  config: CandelaConfig;
  wallet: CandelaWallet | null;
  setWallet: (w: CandelaWallet | null) => void;
};

const CandelaContext = createContext<Ctx | null>(null);

export function CandelaProvider({
  network,
  children,
}: {
  network: "testnet" | CandelaConfig;
  children: ReactNode;
}) {
  const config = useMemo(() => resolveConfig(network), [network]);
  const [wallet, setWallet] = useState<CandelaWallet | null>(null);
  return (
    <CandelaContext.Provider value={{ config, wallet, setWallet }}>
      {children}
    </CandelaContext.Provider>
  );
}

export function useCandela(): Ctx {
  const ctx = useContext(CandelaContext);
  if (!ctx) throw new Error("useCandela requires <CandelaProvider>");
  return ctx;
}
