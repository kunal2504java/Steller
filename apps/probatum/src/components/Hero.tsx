"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import Seal from "./Seal";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type ChainStats = {
  batches: string;
  claims: string;
  network: string;
  contractUrl: string;
};

export default function Hero({ stats }: { stats: ChainStats }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // ── entrance: the room lights up ─────────────────────────
        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .from("[data-hero-line]", {
            yPercent: 110,
            duration: 1.1,
            stagger: 0.09,
          })
          .from(
            "[data-hero-sub], [data-hero-cta], [data-hero-stats]",
            { opacity: 0, y: 18, duration: 0.8, stagger: 0.1 },
            "-=0.5",
          );

        // ── the sealing: scrubbed by the visitor's own scroll ────
        const press = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "+=160%",
            scrub: 0.6,
            pin: true,
          },
          defaults: { ease: "none" },
        });

        press
          // headline recedes as the act begins
          .to("[data-hero-copy]", { yPercent: -14, opacity: 0.25 }, 0)
          // stamp descends
          .fromTo(
            "[data-seal-stamp]",
            { y: -230 },
            { y: 132, duration: 0.45, ease: "power2.in" },
            0.05,
          )
          // contact: wax squashes wide
          .to(
            "[data-seal-wax]",
            { scaleX: 1.14, scaleY: 0.82, duration: 0.07, ease: "power4.out" },
            0.5,
          )
          // flash of light
          .fromTo(
            "[data-seal-flash]",
            { opacity: 0, scale: 0.4, transformOrigin: "220px 310px" },
            { opacity: 1, scale: 1.25, duration: 0.06 },
            0.5,
          )
          .to("[data-seal-flash]", { opacity: 0, duration: 0.12 }, 0.57)
          // the imprint takes
          .fromTo(
            "[data-seal-imprint]",
            { opacity: 0, scale: 1.12, rotation: -4 },
            { opacity: 1, scale: 1, rotation: 0, duration: 0.1 },
            0.53,
          )
          // wax settles
          .to(
            "[data-seal-wax]",
            { scaleX: 1.06, scaleY: 0.92, duration: 0.1, ease: "power2.out" },
            0.58,
          )
          // stamp lifts away, job done
          .to(
            "[data-seal-stamp]",
            { y: -260, duration: 0.32, ease: "power2.out" },
            0.62,
          )
          // verdict appears under the seal
          .fromTo(
            "[data-hero-verdict]",
            { opacity: 0, y: 24 },
            { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" },
            0.72,
          );
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="hero-glow relative flex h-svh flex-col overflow-hidden"
    >
      {/* nav */}
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <span className="eyebrow text-candle">PROBATUM</span>
        <nav className="flex items-center gap-6">
          <a
            href="#verify"
            className="eyebrow text-ash transition-colors hover:text-vellum"
          >
            Verify a certificate
          </a>
          <a
            href="https://github.com/kunal2504java/Steller"
            className="eyebrow text-ash transition-colors hover:text-vellum"
          >
            GitHub
          </a>
        </nav>
      </header>

      {/* headline */}
      <div
        data-hero-copy
        className="flex flex-col items-center px-6 pt-6 text-center md:pt-10"
      >
        <p className="eyebrow mb-6 text-candle/80">
          Sealed on Stellar — verifiable forever
        </p>
        <h1 className="display text-[clamp(3rem,8.5vw,7.75rem)]">
          <span className="block overflow-hidden">
            <span data-hero-line className="block">
              Certificates that
            </span>
          </span>
          <span className="block overflow-hidden">
            <span data-hero-line className="block">
              <em className="display-it flame-text">can&rsquo;t</em>
              <span className="inline-block w-[0.28em]" aria-hidden />
              be faked.
            </span>
          </span>
        </h1>
        <p
          data-hero-sub
          className="mt-7 max-w-xl text-balance text-base text-ash md:text-lg"
        >
          One upload seals a thousand certificates on-chain. Anyone can verify
          them, forever — even if the issuer, or we, disappear.
        </p>
        <div data-hero-cta className="mt-9 flex items-center gap-4">
          <a
            href="#issue"
            className="eyebrow rounded-full bg-candle px-7 py-4 !text-vault transition-transform hover:scale-[1.03]"
          >
            Issue certificates
          </a>
          <a
            href="#verify"
            className="eyebrow rounded-full border border-ash/40 px-7 py-4 text-vellum transition-colors hover:border-candle hover:text-candle"
          >
            Verify one
          </a>
        </div>
      </div>

      {/* the seal, center stage */}
      <div className="relative mx-auto -mt-2 h-[42svh] min-h-[300px] grow">
        <Seal />
        <p
          data-hero-verdict
          className="eyebrow absolute inset-x-0 -bottom-1 whitespace-nowrap text-center text-candle opacity-0"
        >
          Probatum est — it has been proven.
        </p>
      </div>

      {/* live proof strip */}
      <footer
        data-hero-stats
        className="flex items-center justify-center gap-8 border-t border-vellum/10 px-6 py-4 font-mono text-xs text-ash md:gap-14"
      >
        <span>
          <span className="text-candle">{stats.batches}</span>{" "}
          {stats.batches === "1" ? "batch" : "batches"} sealed
        </span>
        <span>
          <span className="text-candle">{stats.claims}</span> certificates
          claimed
        </span>
        <a
          href={stats.contractUrl}
          className="underline decoration-ash/40 underline-offset-4 transition-colors hover:text-candle"
        >
          audit the contract ({stats.network}) ↗
        </a>
      </footer>
    </section>
  );
}
