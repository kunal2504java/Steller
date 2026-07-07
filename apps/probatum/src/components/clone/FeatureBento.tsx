const ORBIT_CHIPS = [
  { label: "in", title: "LinkedIn" },
  { label: "QR", title: "QR verify" },
  { label: "</>", title: "Open source" },
  { label: "✦", title: "Stellar" },
];

export default function FeatureBento() {
  return (
    <section id="proof" className="relative mx-auto max-w-6xl px-4 py-28 md:px-6 md:py-36">
      <div className="mx-auto max-w-2xl text-center">
        <h2 data-reveal className="fade-title text-4xl md:text-5xl">
          Why it can&rsquo;t be faked
        </h2>
        <p data-reveal className="mt-4 text-[15px] leading-relaxed text-ash">
          A PDF proves nothing. A hologram sticker proves nothing. Proof has to
          live somewhere no one — including us — can edit.
        </p>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-12">
        {/* orbit — proof travels everywhere */}
        <div
          data-reveal
          className="glass-card relative col-span-full min-h-[360px] overflow-hidden p-7 md:col-span-7"
        >
          <div className="pointer-events-none absolute inset-x-0 top-10 flex h-[260px] items-center justify-center">
            <div className="orbit-ring size-48" />
            <div className="orbit-ring absolute size-72" />
            {/* center mark */}
            <span className="absolute grid size-16 place-items-center rounded-full bg-gradient-to-br from-sealwax-hot via-sealwax to-[#4d0e1e] shadow-[0_0_50px_-8px_rgba(194,46,77,0.6)]">
              <svg viewBox="0 0 20 20" className="size-7">
                <path
                  d="M 10 2 L 12 8 L 18 10 L 12 12 L 10 18 L 8 12 L 2 10 L 8 8 Z"
                  fill="#f2c56b"
                />
              </svg>
            </span>
            {/* orbiting chips */}
            <div className="orbit-spin absolute size-72">
              {ORBIT_CHIPS.map((c, i) => {
                const a = (i / ORBIT_CHIPS.length) * 2 * Math.PI;
                const x = 50 + 50 * Math.cos(a);
                const y = 50 + 50 * Math.sin(a);
                return (
                  <span
                    key={c.title}
                    title={c.title}
                    className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-vellum/15 bg-soot text-[13px] font-semibold text-vellum shadow-xl"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    {c.label}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="relative mt-[270px]">
            <h3 className="text-xl font-semibold tracking-tight text-vellum">
              Proof travels everywhere
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-ash">
              Recipients share to LinkedIn with the verify link baked in. Every
              share is an advertisement that proves itself.
            </p>
          </div>
        </div>

        {/* dotted globe — verifiable from anywhere */}
        <div
          data-reveal
          data-reveal-delay="0.08"
          className="glass-card relative col-span-full min-h-[360px] overflow-hidden p-7 md:col-span-5"
        >
          <div className="dot-field absolute -right-16 -top-10 size-[340px]" />
          <div className="relative flex h-full flex-col justify-end">
            <p className="fade-title text-5xl md:text-6xl">100+</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-vellum">
              countries, zero logins
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-ash">
              Verification runs against a public ledger. No account, no app, no
              calling the institute — from anywhere on earth.
            </p>
          </div>
        </div>

        {/* one transaction */}
        <div
          data-reveal
          className="glass-card col-span-full p-7 md:col-span-5"
        >
          <p className="fade-title text-5xl md:text-6xl">1 tx</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-vellum">
            seals a thousand certificates
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ash">
            Every certificate is hashed into a merkle tree; one root goes
            on-chain. Cost to you: zero — we sponsor the fees.
          </p>
          <p className="mt-5 break-all rounded-lg border border-vellum/8 bg-vault/60 px-3 py-2 font-mono text-[10px] leading-relaxed text-ash">
            anchor_batch(root: 57c49ece…1902, count: 412) →{" "}
            <span className="text-candle">BatchAnchored ✓</span>
          </p>
        </div>

        {/* the fraud stat */}
        <div
          data-reveal
          data-reveal-delay="0.08"
          className="glass-card col-span-full p-7 md:col-span-7"
        >
          <p className="fade-title text-5xl md:text-6xl">~1,000,000</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-vellum">
            forged certificates, one police raid
          </p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ash">
            Kerala, Dec 2025 — fakes mimicking 28 universities. One Rajasthan
            university alone issued 43,000 fake degrees. DigiLocker covers
            government institutions; your hackathon, fest, academy, NGO — no
            one covers them. That&rsquo;s the gap we seal.
          </p>
        </div>
      </div>
    </section>
  );
}
