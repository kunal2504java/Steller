const STEPS = [
  {
    n: "01",
    title: "A passkey becomes a smart wallet",
    body:
      "Face ID or a fingerprint creates a secp256r1 credential. Candela deploys a Stellar smart wallet controlled by it — no seed phrase, no extension, nothing to write down.",
    code: "<SignUpButton />",
  },
  {
    n: "02",
    title: "You sponsor the fees",
    body:
      "Transactions are fee-bumped by your sponsor account (or a relay). The user signs with their fingerprint and pays nothing — not a cent, not a token.",
    code: "config=\"testnet\"  // you fund it",
  },
  {
    n: "03",
    title: "One hook signs and submits",
    body:
      "useSubmit() simulates, gets the passkey signature, re-simulates for the secp256r1 auth, assembles, and submits. The gnarly parts are handled.",
    code: "const { submit } = useSubmit();",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative mx-auto max-w-6xl px-4 py-28 md:px-6 md:py-36">
      <div className="mx-auto max-w-2xl text-center">
        <h2 data-reveal className="fade-title text-4xl md:text-5xl">
          Three moving parts. You touch one.
        </h2>
        <p data-reveal className="mt-4 text-[15px] leading-relaxed text-ash">
          Candela wraps PasskeyKit, Launchtube, and the secp256r1 signing
          dance so you ship onboarding, not cryptography.
        </p>
      </div>
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            data-reveal
            data-reveal-delay={`${i * 0.08}`}
            className="glass-card p-7"
          >
            <p className="font-mono text-xs text-candle">{s.n}</p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-vellum">
              {s.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ash">{s.body}</p>
            <p className="mt-5 break-all rounded-lg border border-vellum/8 bg-vault/60 px-3 py-2 font-mono text-[11px] text-parchment">
              {s.code}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
