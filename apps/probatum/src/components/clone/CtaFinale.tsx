export default function CtaFinale() {
  return (
    <section
      id="issue"
      className="relative overflow-hidden pb-40 pt-32 md:pb-56 md:pt-44"
    >
      {/* the arc rising from below — Cryptgen's closing gesture */}
      <div className="arc-glow -bottom-[130vw]" aria-hidden />
      <div className="arc-rim -bottom-[118vw]" aria-hidden />
      <div className="grid-bg absolute inset-0" aria-hidden />

      {/* corner brackets */}
      <svg
        className="absolute left-10 top-1/2 hidden h-40 w-16 -translate-y-1/2 text-vellum/15 md:block"
        viewBox="0 0 60 160"
        fill="none"
        aria-hidden
      >
        <path d="M 58 2 L 8 2 L 8 52 M 8 108 L 8 158 L 58 158" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <svg
        className="absolute right-10 top-1/2 hidden h-40 w-16 -translate-y-1/2 scale-x-[-1] text-vellum/15 md:block"
        viewBox="0 0 60 160"
        fill="none"
        aria-hidden
      >
        <path d="M 58 2 L 8 2 L 8 52 M 8 108 L 8 158 L 58 158" stroke="currentColor" strokeWidth="1.5" />
      </svg>

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <h2 data-reveal className="fade-title text-4xl md:text-6xl">
          Issue 1,000 certificates
          <br />
          in five minutes. Free.
        </h2>
        <p data-reveal className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-ash">
          A CSV of names in, unforgeable proof out. No wallets, no jargon, no
          onboarding call — sealed on Stellar while you watch.
        </p>
        <div data-reveal className="mt-9 flex items-center justify-center gap-3">
          <a href="#" className="pill-metal">
            Start issuing now
          </a>
          <a
            href="https://github.com/kunal2504java/Steller"
            className="pill-ghost"
          >
            Read the source
          </a>
        </div>
        <p data-reveal className="eyebrow mt-10 text-candle/60">
          Probatum est — sealed on Stellar
        </p>
      </div>
    </section>
  );
}
