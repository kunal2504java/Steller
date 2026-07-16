"use client";

import { useEffect, useState, type ReactNode } from "react";

export default function VerificationShell({
  state,
  children,
}: {
  state: "VALID" | "REVOKED" | "TAMPERED" | "UNAVAILABLE";
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  return (
    <div
      className="verification-shell"
      data-ready={ready ? "true" : "false"}
      data-verdict={state.toLowerCase()}
    >
      {children}
    </div>
  );
}
