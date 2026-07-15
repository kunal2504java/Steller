"use client";
import { useCandela } from "./context";

export function useWallet() {
  const { wallet, setWallet, isHydrated } = useCandela();
  return {
    wallet,
    isConnected: wallet !== null,
    isHydrated,
    disconnect: () => setWallet(null),
  };
}
