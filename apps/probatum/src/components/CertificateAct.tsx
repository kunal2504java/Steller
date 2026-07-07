"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* deterministic QR-ish pattern — no Math.random, no hydration drift */
const QR =
  "1111101010111110000101110100010111011101101110101110110001010001000101111101010101111100000111011000001101011011100110101110010101000100011101100010111011110110001110110001000100000101011111010111011";

const ANNOTATIONS = [
  {
    key: "seal",
    title: "Pressed, not printed",
    body: "The seal is a Stellar transaction. Batch #1, anchored on-chain — a fact no editor, including us, can change.",
  },
  {
    key: "qr",
    title: "Scan to verify",
    body: "The QR opens a verify page that checks the chain live. No login, no app, no calling the institute.",
  },
  {
    key: "hash",
    title: "Fingerprinted",
    body: "This exact document, hashed. A merkle proof ties it to the sealed batch — change one letter and it fails.",
  },
  {
    key: "status",
    title: "Alive, not archived",
    body: "Issuers can revoke. A revoked certificate fails verification everywhere, instantly — unlike a PDF in the wild.",
  },
] as const;

export default function CertificateAct() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        "(prefers-reduced-motion: no-preference) and (min-width: 768px)",
        () => {
          const steps = gsap.utils.toArray<HTMLElement>("[data-annotation]");
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: `+=${ANNOTATIONS.length * 90}%`,
              scrub: 0.5,
              pin: true,
            },
            defaults: { ease: "none" },
          });

          steps.forEach((step, i) => {
            const at = i / ANNOTATIONS.length;
            const key = step.dataset.annotation;
            tl.fromTo(
              step,
              { opacity: 0, y: 36 },
              { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" },
              at,
            );
            if (i > 0) {
              tl.to(
                steps[i - 1],
                { opacity: 0.22, duration: 0.1 },
                at,
              );
            }
            // spotlight the matching part of the certificate
            tl.fromTo(
              `[data-cert-part="${key}"]`,
              { boxShadow: "0 0 0 0 rgba(217,164,65,0)" },
              {
                boxShadow:
                  "0 0 0 3px rgba(217,164,65,0.85), 0 0 34px 2px rgba(217,164,65,0.25)",
                duration: 0.1,
                ease: "power2.out",
              },
              at + 0.02,
            );
            if (i > 0) {
              tl.to(
                `[data-cert-part="${steps[i - 1].dataset.annotation}"]`,
                { boxShadow: "0 0 0 0 rgba(217,164,65,0)", duration: 0.08 },
                at,
              );
            }
          });

          // the artifact breathes while pinned
          gsap.to("[data-cert-card]", {
            rotation: 1.4,
            yPercent: -3,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: `+=${ANNOTATIONS.length * 90}%`,
              scrub: 1,
            },
          });
        },
      );
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative flex min-h-svh flex-col justify-center overflow-hidden bg-vellum px-6 py-24 text-ink md:px-10"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-20">
        {/* the artifact */}
        <div className="flex justify-center md:justify-end">
          <div
            data-cert-card
            className="w-full max-w-[420px] rotate-[-1.2deg] rounded-sm border border-candle/60 bg-card p-3 shadow-[0_30px_80px_-20px_rgba(36,30,20,0.45)]"
          >
            <div className="flex h-full flex-col border border-ink/15 px-7 py-8">
              <p className="eyebrow text-sealwax">HackBengaluru 2026</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-inkfaint">
                This certifies that
              </p>
              <p className="display mt-2 text-4xl text-ink">Ananya Sharma</p>
              <p className="mt-3 text-sm leading-relaxed text-inkfaint">
                placed <em className="display-it text-sealwax">first</em> among
                412 builders — and this document will still prove it in twenty
                years.
              </p>

              <div className="mt-8 flex items-end justify-between gap-4">
                {/* the seal */}
                <div
                  data-cert-part="seal"
                  className="grid size-16 place-items-center rounded-full bg-sealwax"
                >
                  <svg viewBox="0 0 40 40" className="size-10">
                    <path
                      d="M 20 6 L 23.5 16.5 L 34 20 L 23.5 23.5 L 20 34 L 16.5 23.5 L 6 20 L 16.5 16.5 Z"
                      fill="#f2c56b"
                      fillOpacity="0.85"
                    />
                  </svg>
                </div>
                {/* the QR */}
                <div data-cert-part="qr" className="bg-card p-1">
                  <div className="grid grid-cols-[repeat(14,5px)] grid-rows-[repeat(14,5px)]">
                    {QR.split("").map((bit, i) => (
                      <span
                        key={i}
                        className={bit === "1" ? "bg-ink" : "bg-transparent"}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div
                data-cert-part="hash"
                className="mt-7 rounded border border-ink/10 bg-vellum px-3 py-2"
              >
                <p className="truncate font-mono text-[10px] text-inkfaint">
                  leaf 65656565…6565 · batch #1 · root 57c49ece…1902
                </p>
              </div>

              <p
                data-cert-part="status"
                className="mt-3 inline-flex items-center gap-2 self-start rounded px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-sealwax"
              >
                <span className="size-1.5 rounded-full bg-sealwax" />
                Probatum est — verified live
              </p>
            </div>
          </div>
        </div>

        {/* the annotations */}
        <div>
          <p className="eyebrow mb-3 text-sealwax">The artifact</p>
          <h2 className="display mb-12 text-[clamp(2rem,4vw,3.2rem)] text-ink">
            Every certificate carries{" "}
            <em className="display-it">its own proof.</em>
          </h2>
          <ol className="flex flex-col gap-9">
            {ANNOTATIONS.map((a) => (
              <li key={a.key} data-annotation={a.key}>
                <h3 className="font-mono text-sm uppercase tracking-[0.16em] text-sealwax">
                  {a.title}
                </h3>
                <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-inkfaint">
                  {a.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
