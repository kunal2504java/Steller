import CopyButton from "./CopyButton";

export default function Hero() {
  return (
    <header className="relative overflow-hidden pb-16 pt-40 md:pt-48">
      <div className="grid-bg absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh]"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(255,255,255,0.06) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <p data-reveal className="eyebrow mb-6 text-candle/80">
          Open-source passkey kit for Stellar
        </p>
        <h1
          data-reveal
          data-reveal-delay="0.05"
          className="fade-title text-5xl md:text-7xl"
        >
          Web3 UX
          <br />
          should not suck.
        </h1>
        <p
          data-reveal
          className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ash md:text-lg"
        >
          Passkey onboarding for Stellar — no seed phrase, no browser
          extension, no gas. One React kit turns a fingerprint into a smart
          wallet and a sponsored transaction.
        </p>
        <div data-reveal className="mt-9 flex items-center justify-center gap-3">
          <CopyButton text="npm i candela-kit" />
          <a href="/probatum" className="pill-ghost">
            See it live →
          </a>
        </div>
      </div>
    </header>
  );
}
