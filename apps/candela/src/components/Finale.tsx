import CopyButton from "./CopyButton";

export default function Finale() {
  return (
    <>
      <section className="relative overflow-hidden py-40">
        <div className="arc-glow -bottom-[130vw]" aria-hidden />
        <div className="arc-rim -bottom-[120vw]" aria-hidden />
        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
          <h2 data-reveal className="fade-title text-4xl md:text-6xl">
            Ship onboarding
            <br />
            that doesn&rsquo;t suck.
          </h2>
          <div data-reveal className="mt-9 flex items-center justify-center gap-3">
            <CopyButton text="npm i candela-kit" />
            <a
              href="https://github.com/kunal2504java/Steller"
              className="pill-ghost"
            >
              Star on GitHub
            </a>
          </div>
        </div>
      </section>
      <footer className="border-t border-vellum/8 px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <span className="flex items-center gap-2.5">
            <span className="relative grid size-6 place-items-center rounded-full bg-gradient-to-br from-sealwax-hot via-sealwax to-[#4d0e1e]">
              <svg viewBox="0 0 20 20" className="size-3">
                <path
                  d="M 10 2 L 12 8 L 18 10 L 12 12 L 10 18 L 8 12 L 2 10 L 8 8 Z"
                  fill="#f2c56b"
                />
              </svg>
            </span>
            <span className="text-sm font-semibold text-vellum">Candela</span>
          </span>
          <p className="font-mono text-[11px] text-ash">
            passkey onboarding for Stellar · MIT
          </p>
        </div>
      </footer>
    </>
  );
}
