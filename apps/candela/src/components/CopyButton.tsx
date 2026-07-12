"use client";

import { useState, type ReactNode } from "react";

export function copyLabel(copied: boolean, base: string): string {
  return copied ? "copied ✓" : base;
}

export default function CopyButton({
  text,
  className = "pill-metal",
  children,
}: {
  text: string;
  className?: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const label = children ?? (
    <span className="font-mono">{copyLabel(copied, text)}</span>
  );
  return (
    <button
      type="button"
      className={className}
      aria-label={`Copy ${text}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked — no-op, label unchanged */
        }
      }}
    >
      {label}
    </button>
  );
}
