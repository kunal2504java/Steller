const STATES = [
  {
    badge: "VALID",
    tone: "text-candle border-candle/40",
    name: "Build Station Demo Recipient — Proof of Completion",
    line: "Merkle proof matches live batch #2 · issuer resolved · not revoked.",
    verdict: "Probatum est — it has been proven.",
    rot: "md:-rotate-1",
  },
  {
    badge: "REVOKED",
    tone: "text-sealwax-hot border-sealwax-hot/40",
    name: "Certificate withdrawn by issuer",
    line: "The proof still matches — but the issuer revoked this leaf on-chain.",
    verdict: "Fails verification everywhere, instantly.",
    rot: "md:rotate-[0.5deg]",
  },
  {
    badge: "TAMPERED",
    tone: "text-sealwax-hot border-sealwax-hot/40",
    name: "One letter changed in the PDF",
    line: "Recomputed hash no longer matches the sealed root. Proof collapses.",
    verdict: "Forgery visible in one second.",
    rot: "md:rotate-1",
  },
];

export default function VerifyStack({ demoHref }: { demoHref: string }) {
  return (
    <section id="verify" className="mx-auto grid max-w-6xl gap-12 px-4 py-28 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:px-6 md:py-36">
      <div className="md:sticky md:top-32 md:self-start">
        <h2 data-reveal className="fade-title text-4xl md:text-5xl">
          What verification
          <br />
          looks like
        </h2>
        <p data-reveal className="mt-4 max-w-sm text-[15px] leading-relaxed text-ash">
          Scan the QR or paste a link. The check runs against Stellar in
          real time — three outcomes, no ambiguity, no phone calls.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {STATES.map((s, i) => (
          <article
            key={s.badge}
            data-reveal
            data-reveal-delay={i * 0.06}
            className={`glass-card p-6 ${s.rot}`}
          >
            <span
              className={`inline-block rounded-full border px-2.5 py-1 font-mono text-[9px] tracking-[0.16em] ${s.tone}`}
            >
              {s.badge}
            </span>
            <p className="mt-4 text-lg font-semibold tracking-tight text-vellum">
              {s.name}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ash">{s.line}</p>
            <p className="mt-4 font-mono text-[11px] text-ash/80">
              → {s.verdict}
            </p>
          </article>
        ))}
        <a href={demoHref} className="pill-metal mt-3 self-start">
          Open the seeded VALID proof
        </a>
      </div>
    </section>
  );
}
