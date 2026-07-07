"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The case file. Every claim here is real and cited on the page.
 * Redaction bars wipe away as you scroll — the reader declassifies
 * the fraud themselves.
 */
const EXHIBITS = [
  {
    figure: "~1,000,000",
    line: "forged certificates, one police raid",
    detail: "Kerala Police, Dec 2025 — fakes mimicking 28 real universities",
  },
  {
    figure: "43,000+",
    line: "fake degrees from a single university",
    detail: "holders discovered in government jobs, Rajasthan 2024",
  },
  {
    figure: "0",
    line: "verification rails for everyone else",
    detail:
      "DigiLocker covers government-recognized institutions. Your hackathon, fest, academy, NGO — no one covers them.",
  },
];

export default function Problem() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-redaction]").forEach((bar) => {
          gsap.to(bar, {
            scaleX: 0,
            transformOrigin: "right center",
            ease: "power3.inOut",
            duration: 0.9,
            scrollTrigger: { trigger: bar, start: "top 72%" },
          });
        });
        gsap.utils.toArray<HTMLElement>("[data-exhibit]").forEach((el, i) => {
          gsap.from(el, {
            opacity: 0,
            y: 32,
            duration: 0.8,
            delay: i * 0.05,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 80%" },
          });
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative px-6 py-28 md:px-10 md:py-40">
      <div className="mx-auto max-w-5xl">
        <p className="eyebrow mb-4 text-sealwax-hot">The problem — exhibit A</p>
        <h2 className="display max-w-3xl text-[clamp(2.2rem,5.5vw,4.5rem)]">
          Anyone can print a{" "}
          <span className="relative inline-block">
            <em className="display-it">certificate.</em>
            <span
              data-redaction
              className="absolute inset-0 -mx-1 bg-sealwax"
              aria-hidden
            />
          </span>
        </h2>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-vellum/10 bg-vellum/10 md:mt-24 md:grid-cols-3">
          {EXHIBITS.map((e) => (
            <article
              key={e.figure}
              data-exhibit
              className="bg-vault px-7 py-9 md:px-8 md:py-12"
            >
              <p className="font-mono text-4xl text-candle md:text-5xl">
                {e.figure}
              </p>
              <p className="mt-3 text-base text-vellum md:text-lg">{e.line}</p>
              <p className="mt-4 font-mono text-xs leading-relaxed text-ash">
                {e.detail}
              </p>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-16 max-w-2xl text-center text-lg text-ash md:mt-24 md:text-xl">
          A PDF proves nothing. A hologram sticker proves nothing.
          <br className="hidden md:block" />
          <span className="text-vellum">
            {" "}
            Proof has to live somewhere no one — including us —{" "}
            <em className="display-it text-candle">can edit.</em>
          </span>
        </p>
      </div>
    </section>
  );
}
