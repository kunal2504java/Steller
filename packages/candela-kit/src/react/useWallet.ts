"use client";
import { useCandela } from "./context";

export function useWallet() {
  const { wallet, setWallet } = useCandela();
  return {
    wallet,
    isConnected: wallet !== null,
    disconnect: () => setWallet(null),
  };
}
