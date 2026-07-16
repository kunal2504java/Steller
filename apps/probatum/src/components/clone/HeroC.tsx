import type { ChainStats } from "@/lib/chain";

export default function HeroC({
  stats,
  demoHref,
  demoQrDataUrl,
  demoTx,
}: {
  stats: ChainStats;
  demoHref: string;
  demoQrDataUrl: string;
  demoTx: string;
}) {
  return (
    <header className="relative overflow-hidden pb-10 pt-40 md:pt-48">
      {/* atmosphere: the clone's — black, a grid, one soft light */}
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
          Sealed on Stellar — verifiable forever
        </p>
        <h1
          data-reveal
          data-reveal-delay="0.05"
          className="fade-title text-5xl md:text-7xl"
        >
          Certificates that
          <br />
          can&rsquo;t be faked.
        </h1>
        <p
          data-reveal
          className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ash md:text-lg"
        >
          One upload seals a thousand certificates on-chain. Anyone can verify
          them, forever — even if the issuer, or we, disappear.
        </p>
        <div
          data-reveal
          className="mt-9 flex items-center justify-center gap-3"
        >
          <a href={demoHref} className="pill-metal">
            Verify the live demo
          </a>
          <a href="#proof" className="pill-ghost">
            See how it works
          </a>
        </div>
      </div>

      {/* the product, glass bento — Probatum's issuer dashboard */}
      <div
        data-reveal
        id="product"
        className="relative z-10 mx-auto mt-20 grid w-full max-w-6xl grid-cols-2 gap-3 px-4 md:grid-cols-12 md:gap-4 md:px-6"
      >
        <div className="glass-card col-span-2 p-5 md:col-span-3">
          <p className="text-xs text-ash">Batches anchored</p>
          <p className="mt-1.5 text-3xl font-semibold tracking-tight text-vellum">
            {stats.batches}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-candle">
            live contract counter
          </p>
          <p className="mt-6 font-mono text-[10px] leading-relaxed text-ash">#1 KAT genesis<br />#2 shareable demo</p>
        </div>

        <div className="glass-card col-span-2 p-5 md:col-span-3">
          <p className="text-xs text-ash">Passkey claims</p>
          <p className="mt-1.5 text-3xl font-semibold tracking-tight text-vellum">
            {stats.claims}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-ash">
            read live from Stellar
          </p>
          <p className="mt-6 text-xs leading-relaxed text-ash">Every claim binds one certificate leaf to one Candela smart wallet. No token is minted.</p>
        </div>

        <div className="glass-card col-span-2 p-5 md:col-span-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ash">Batch #1</p>
            <span className="rounded-full border border-candle/30 px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] text-candle">
              ANCHORED ✓
            </span>
          </div>
          <p className="mt-3 break-all font-mono text-[10px] leading-relaxed text-ash">
            root 57c49ece…1902
            <br />
            tx {stats.genesisTx.slice(0, 8)}…{stats.genesisTx.slice(-4)}
          </p>
          <a
            href={stats.contractUrl}
            className="mt-3 inline-block font-mono text-[10px] text-candle underline decoration-candle/40 underline-offset-4"
          >
            view on stellar.expert ↗
          </a>
        </div>

        <div className="glass-card col-span-2 p-5 md:col-span-3">
          <p className="text-xs text-ash">Revocations</p>
          <p className="mt-1.5 text-3xl font-semibold tracking-tight text-vellum">
            0
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-ash">
            active in this batch
          </p>
          <p className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] text-candle">
            <span className="size-1.5 animate-pulse rounded-full bg-candle" />
            live from {stats.network}
          </p>
        </div>

        <div className="glass-card col-span-2 p-5 md:col-span-7">
          <p className="text-xs text-ash">Live proof artifacts</p>
          <ul className="mt-3 divide-y divide-vellum/8">
            <li className="flex items-center gap-3 py-2.5">
              <span className="font-mono text-[10px] text-candle">#01</span>
              <span className="text-[13px] font-medium text-vellum">KAT genesis batch</span>
              <span className="ml-auto font-mono text-[10px] text-ash">{stats.genesisTx.slice(0, 8)}…</span>
            </li>
            <li className="flex items-center gap-3 py-2.5">
              <span className="font-mono text-[10px] text-candle">#02</span>
              <span className="text-[13px] font-medium text-vellum">Public demo batch</span>
              <span className="ml-auto font-mono text-[10px] text-ash">{demoTx.slice(0, 8)}…</span>
            </li>
            <li className="flex items-center gap-3 py-2.5">
              <span className="font-mono text-[10px] text-candle">CLM</span>
              <span className="text-[13px] font-medium text-vellum">On-chain claims</span>
              <span className="ml-auto font-mono text-[10px] text-ash">{stats.claims}</span>
            </li>
          </ul>
        </div>

        <div className="glass-card col-span-2 flex items-center gap-5 p-5 md:col-span-5">
          <a href={demoHref} className="shrink-0 rounded-lg bg-vellum p-2" aria-label="Open the live demo verification">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={demoQrDataUrl} alt="QR code to the live Probatum demo" width={80} height={80} className="size-20" />
          </a>
          <div>
            <p className="text-[13px] font-medium text-vellum">
              Every certificate ships with its QR
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ash">
              This code opens the seeded batch #2 proof. Scan → recompute →
              live Stellar verdict.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
