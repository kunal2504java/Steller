"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Three acts, scrolled sideways — the whole product in one gesture.
 * The numbering is real sequence: this is literally the order it happens.
 */
const ACTS = [
  {
    n: "I",
    title: "Upload a list",
    em: "names in,",
    emRest: " nothing else.",
    body: "A CSV of names. Pick a template. That's the entire ask — no wallets, no jargon, no onboarding call.",
    art: "csv",
  },
  {
    n: "II",
    title: "We press the seal",
    em: "one transaction,",
    emRest: " a thousand certificates.",
    body: "Every certificate is hashed into a merkle tree; the root is sealed on Stellar in a single transaction. Cost to you: zero.",
    art: "seal",
  },
  {
    n: "III",
    title: "Everyone shares",
    em: "every share,",
    emRest: " a proof.",
    body: "Recipients post to LinkedIn with their name on the card and a verify link baked in. Your event's proof travels with every share.",
    art: "share",
  },
] as const;

function PanelArt({ kind }: { kind: (typeof ACTS)[number]["art"] }) {
  if (kind === "csv") {
    return (
      <div className="w-64 rounded-lg border border-vellum/15 bg-soot p-4 font-mono text-[11px] leading-6 text-ash shadow-2xl">
        <p className="text-candle">participants.csv</p>
        <p>Ananya Sharma, First Place</p>
        <p>Rahul Verma, Finalist</p>
        <p>Meera Iyer, Finalist</p>
        <p className="text-vellum/30">… 409 more rows</p>
      </div>
    );
  }
  if (kind === "seal") {
    return (
      <div className="w-64 rounded-lg border border-vellum/15 bg-soot p-4 font-mono text-[11px] leading-6 text-ash shadow-2xl">
        <p className="text-candle">tx 4c69c26d…78d6</p>
        <p>
          fn <span className="text-vellum">anchor_batch</span>
        </p>
        <p>root 57c49ece…1902</p>
        <p>count 412</p>
        <p className="text-sealwax-hot">event BatchAnchored ✓</p>
      </div>
    );
  }
  return (
    <div className="w-64 rounded-lg border border-vellum/15 bg-soot p-4 shadow-2xl">
      <div className="flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-full bg-sealwax font-mono text-[10px] text-candle-bright">
          AS
        </div>
        <div>
          <p className="text-xs text-vellum">Ananya Sharma</p>
          <p className="font-mono text-[10px] text-ash">just now · in</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ash">
        Placed 1st at HackBengaluru 🏆 — certificate sealed on-chain:
      </p>
      <p className="mt-2 font-mono text-[10px] text-candle underline underline-offset-2">
        probatum.app/c/hbg26-001
      </p>
    </div>
  );
}

export default function HowItWorks() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        "(prefers-reduced-motion: no-preference) and (min-width: 768px)",
        () => {
          const panels = ACTS.length;
          gsap.to(track.current, {
            xPercent: -(100 * (panels - 1)) / panels,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: "+=180%",
              scrub: 0.6,
              pin: true,
            },
          });
        },
      );
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative overflow-hidden bg-vault">
      <div ref={track} className="flex flex-col md:w-max md:flex-row">
        {ACTS.map((act) => (
          <div
            key={act.n}
            className="flex min-h-svh w-screen shrink-0 flex-col items-center justify-center gap-10 px-8 py-24 md:flex-row md:gap-20"
          >
            <div className="max-w-md">
              <p className="eyebrow mb-4 text-candle/70">
                Act {act.n} — how it works
              </p>
              <h3 className="display text-[clamp(2.2rem,4.5vw,3.8rem)]">
                {act.title}
                <span className="mt-1 block">
                  <em className="display-it flame-text">{act.em}</em>
                  {act.emRest}
                </span>
              </h3>
              <p className="mt-6 max-w-sm leading-relaxed text-ash">
                {act.body}
              </p>
            </div>
            <PanelArt kind={act.art} />
          </div>
        ))}
      </div>
    </section>
  );
}
