"use client";

import { useEffect, useState } from "react";
import { SCRIPT_LINES, initialFrame, type Frame } from "./terminal-script";

function lineClass(line: string): string {
  if (line.startsWith("$")) return "term-line--command";
  if (line.startsWith("✓") || line.trimEnd().endsWith("✓"))
    return "term-line--success";
  if (line.startsWith("//")) return "term-line--comment";
  if (line.startsWith("→")) return "term-line--output";
  return "term-line--code";
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
    <section className="candela-terminal-section relative mx-auto max-w-4xl px-5 pb-12 md:px-6 md:pb-16">
      <div data-reveal className="mac-terminal overflow-hidden">
        <div className="mac-terminal-titlebar">
          <div className="mac-terminal-controls" aria-hidden="true">
            <span className="mac-terminal-dot mac-terminal-dot--close" />
            <span className="mac-terminal-dot mac-terminal-dot--minimize" />
            <span className="mac-terminal-dot mac-terminal-dot--zoom" />
          </div>
          <div className="mac-terminal-title">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="1" y="2" width="14" height="12" rx="2" />
              <path d="m4 6 2 2-2 2M8 10h4" />
            </svg>
            <span>candela — zsh — 80×24</span>
          </div>
          <span className="mac-terminal-titlebar-spacer" aria-hidden="true" />
        </div>

        <div className="mac-terminal-tabbar" aria-hidden="true">
          <div className="mac-terminal-tab">
            <span className="mac-terminal-tab-icon">›_</span>
            <span>candela-kit</span>
            <span className="mac-terminal-tab-close">×</span>
          </div>
          <span className="mac-terminal-new-tab">+</span>
        </div>

        <pre className="term min-h-[25rem] overflow-x-auto px-5 py-6 md:px-7 md:py-7">
          {frame.visibleLines.map((line, idx) => {
            const isLast = idx === frame.visibleLines.length - 1;
            return (
              <span key={idx} className={`term-line ${lineClass(line)}`}>
                {line || "\u00a0"}
                {!frame.done && isLast && <span className="term-caret" />}
              </span>
            );
          })}
        </pre>
      </div>
    </section>
  );
}
