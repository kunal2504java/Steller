"use client";

import { CandelaProvider } from "candela-kit";
import type { ReactNode } from "react";

export default function CandelaClaimProvider({ children }: { children: ReactNode }) {
  return (
    <CandelaProvider
      network="testnet"
      submissionUrl="/api/candela/submit"
      storageKey="probatum:testnet:wallet"
    >
      {children}
    </CandelaProvider>
  );
}
