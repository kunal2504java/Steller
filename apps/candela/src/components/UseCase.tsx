import type { ChainStats } from "@/lib/chain";

export default function UseCase({ stats }: { stats: ChainStats }) {
  return (
    <section id="usecase" className="relative mx-auto max-w-6xl px-4 py-28 md:px-6 md:py-36">
      <div className="mx-auto max-w-2xl text-center">
        <p data-reveal className="eyebrow mb-4 text-candle/80">
          One kit, real products
        </p>
        <h2 data-reveal className="fade-title text-4xl md:text-5xl">
          Built with Candela: Probatum
        </h2>
        <p data-reveal className="mt-4 text-[15px] leading-relaxed text-ash">
          Certificates that can&rsquo;t be faked. Recipients claim into a
          passkey wallet and share a proof anyone can verify forever — the
          entire onboarding is Candela.
        </p>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-12">
        <div data-reveal className="glass-card col-span-full p-7 md:col-span-7">
          <p className="text-xs text-ash">Live on {stats.network}</p>
          <p className="mt-1.5 text-4xl font-semibold tracking-tight text-vellum">
            {stats.sponsoredTxns}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-candle">
            sponsored actions through the kit
          </p>
          <p className="mt-5 break-all font-mono text-[10px] leading-relaxed text-ash">
            genesis tx {stats.genesisTx.slice(0, 8)}…{stats.genesisTx.slice(-4)}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/probatum" className="pill-metal">
              Open Probatum →
            </a>
            <a href={stats.contractUrl} className="pill-ghost font-mono text-[13px]">
              view contract ↗
            </a>
          </div>
        </div>

        <div
          data-reveal
          data-reveal-delay="0.08"
          className="glass-card relative col-span-full min-h-[300px] overflow-hidden p-7 md:col-span-5"
        >
          <div className="dot-field absolute -right-16 -top-10 size-[340px]" />
          <div className="relative flex h-full flex-col justify-end">
            <p className="fade-title text-5xl md:text-6xl">0 → wallet</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-vellum">
              in one fingerprint
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-ash">
              No account, no seed phrase, no gas. The recipient never learns
              they used a blockchain — which is the point.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
