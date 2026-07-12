"use client";

import { useEffect, useState } from "react";
import { SCRIPT_LINES, initialFrame, type Frame } from "./terminal-script";

function lineClass(line: string): string {
  if (line.startsWith("$")) return "text-vellum";
  if (line.startsWith("✓") || line.trimEnd().endsWith("✓"))
    return "text-candle";
  if (line.startsWith("//")) return "text-ash";
  if (line.startsWith("→")) return "text-parchment";
  return "text-parchment";
}

export default function Terminal() {
  const [frame, setFrame] = useState<Frame>(() => initialFrame(false));

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      setFrame(initialFrame(true));
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setFrame({
        visibleLines: SCRIPT_LINES.slice(0, i),
        done: i >= SCRIPT_LINES.length,
      });
      if (i >= SCRIPT_LINES.length) clearInterval(id);
    }, 380);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative mx-auto max-w-3xl px-6 pb-8">
      <div data-reveal className="glass-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-vellum/8 px-4 py-3">
          <span className="term-dot bg-sealwax-hot/70" />
          <span className="term-dot bg-candle/40" />
          <span className="term-dot bg-vellum/20" />
          <span className="ml-3 font-mono text-[11px] text-ash">
            candela — passkey onboarding
          </span>
        </div>
        <pre className="term min-h-[22rem] overflow-x-auto px-5 py-4">
          {frame.visibleLines.map((line, idx) => {
            const isLast = idx === frame.visibleLines.length - 1;
            return (
              <div key={idx} className={lineClass(line)}>
                {line || " "}
                {!frame.done && isLast && <span className="term-caret" />}
              </div>
            );
          })}
        </pre>
      </div>
    </section>
  );
}
