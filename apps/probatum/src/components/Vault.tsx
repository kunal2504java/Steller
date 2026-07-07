"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const CANDELA_SNIPPET = `import { CandelaProvider, SignUpButton } from "candela-kit";

<CandelaProvider network="testnet">
  <SignUpButton onWallet={(w) => seal(w.address)} />
</CandelaProvider>`;

export default function Vault({
  contractUrl,
  network,
}: {
  contractUrl: string;
  network: string;
}) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-vault-reveal]").forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 36,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 78%" },
          });
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative overflow-hidden px-6 pt-28 md:px-10 md:pt-40"
    >
      {/* atmosphere returns for the finale */}
      <div className="aurora" aria-hidden>
        <span className="aurora-blob blob-violet" style={{ opacity: 0.5 }} />
        <span className="aurora-blob blob-wine" style={{ opacity: 0.45 }} />
        <span className="aurora-blob blob-gold" style={{ opacity: 0.18 }} />
      </div>
      <div className="relative z-10">
      {/* permanence */}
      <div data-vault-reveal className="mx-auto max-w-4xl text-center">
        <p className="eyebrow mb-4 text-candle/70">The vault</p>
        <h2 className="display text-[clamp(2.2rem,5.5vw,4.5rem)]">
          Built to outlive <em className="display-it flame-text">everyone.</em>
        </h2>
        <p className="mx-auto mt-7 max-w-2xl leading-relaxed text-ash">
          Fest committees dissolve every year. Startups die — maybe even this
          one. The proof doesn&rsquo;t care: the registry is an open-source
          contract on a public ledger, and any certificate verifies against it
          with or without us.
        </p>
        <a
          href={contractUrl}
          className="mt-8 inline-block rounded-full border border-candle/40 px-6 py-3 font-mono text-xs tracking-[0.14em] text-candle transition-colors hover:bg-candle hover:text-vault"
        >
          READ THE CONTRACT ON-CHAIN ({network.toUpperCase()}) ↗
        </a>
      </div>

      {/* candela teaser */}
      <div
        data-vault-reveal
        className="mx-auto mt-28 grid max-w-5xl items-center gap-12 md:mt-40 md:grid-cols-2"
      >
        <div>
          <p className="eyebrow mb-4 text-candle/70">
            Built on Candela — our open-source kit
          </p>
          <h3 className="display text-[clamp(1.9rem,3.6vw,3rem)]">
            Your fingerprint <em className="display-it">is</em> your wallet.
          </h3>
          <p className="mt-5 max-w-md leading-relaxed text-ash">
            No seed phrases, no gas, no crypto vocabulary — a passkey tap
            creates a smart wallet and sponsors every fee. We built the kit so
            no Stellar app&rsquo;s UX ever has to suck again.{" "}
            <span className="font-mono text-xs text-inkfaint">
              lumen = candela · steradian.
            </span>
          </p>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-vellum/12 bg-soot p-6 font-mono text-[12px] leading-relaxed text-vellum/85 shadow-2xl">
          <code>{CANDELA_SNIPPET}</code>
        </pre>
      </div>

      {/* CTA */}
      <div
        data-vault-reveal
        className="mx-auto mt-32 max-w-4xl pb-32 text-center md:mt-48 md:pb-44"
      >
        <h2 className="display text-[clamp(2.4rem,6vw,5.2rem)]">
          Issue 1,000 certificates
          <span className="block">
            in <em className="display-it flame-text">five minutes.</em> Free.
          </span>
        </h2>
        <div className="mt-10 flex items-center justify-center gap-4">
          <a
            href="#issue"
            className="eyebrow rounded-full bg-candle px-8 py-4 !text-vault transition-transform hover:scale-[1.03]"
          >
            Start issuing
          </a>
          <a
            href="https://github.com/kunal2504java/Steller"
            className="eyebrow rounded-full border border-ash/40 px-8 py-4 text-vellum transition-colors hover:border-candle hover:text-candle"
          >
            Read the source
          </a>
        </div>
      </div>

      {/* footer */}
      <footer className="border-t border-vellum/10 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 px-2 font-mono text-[11px] tracking-[0.14em] text-ash md:flex-row">
          <span className="text-candle">PROBATUM</span>
          <span>PROVEN ON STELLAR · {network.toUpperCase()}</span>
          <span>MIT · BUILT IN INDIA</span>
        </div>
      </footer>
      </div>
    </section>
  );
}
