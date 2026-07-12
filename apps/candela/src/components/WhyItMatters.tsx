const POINTS = [
  { k: "MIT", v: "open source", d: "Read every line. Fork it. Ship it." },
  { k: "TS", v: "typed end to end", d: "React 19 provider, hooks, buttons." },
  { k: "R2", v: "secp256r1 native", d: "Real passkeys, not a custodial shim." },
  { k: "★", v: "live on Stellar", d: "Proven on testnet, mainnet-ready." },
];

export default function WhyItMatters() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 py-24 md:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 data-reveal className="fade-title text-4xl md:text-5xl">
          The piece Web3 keeps getting wrong
        </h2>
        <p data-reveal className="mt-4 text-[15px] leading-relaxed text-ash">
          Onboarding is where users quit. Candela makes the first thirty
          seconds feel like any good app — and keeps the chain underneath.
        </p>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
        {POINTS.map((p, i) => (
          <div
            key={p.v}
            data-reveal
            data-reveal-delay={`${i * 0.06}`}
            className="glass-card p-6"
          >
            <p className="font-mono text-2xl text-candle">{p.k}</p>
            <p className="mt-2 text-sm font-semibold text-vellum">{p.v}</p>
            <p className="mt-1 text-xs leading-relaxed text-ash">{p.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
