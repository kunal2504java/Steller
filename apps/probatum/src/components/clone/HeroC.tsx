import type { ChainStats } from "@/lib/chain";

/* deterministic sparkline + bars — no randomness, no hydration drift */
const SPARK = [4, 6, 5, 9, 8, 12, 11, 16, 14, 19, 22, 27];
const BARS = [7, 12, 9, 16, 13, 20, 24];
const CLAIMS = [
  { n: "Ananya Sharma", d: "claimed with a passkey", t: "2m" },
  { n: "Rahul Verma", d: "claimed with a passkey", t: "9m" },
  { n: "Meera Iyer", d: "verified by employer", t: "31m" },
];

function Spark() {
  const max = Math.max(...SPARK);
  const pts = SPARK.map(
    (v, i) => `${(i / (SPARK.length - 1)) * 180},${46 - (v / max) * 40}`,
  ).join(" ");
  return (
    <svg viewBox="0 0 180 48" className="h-12 w-full">
      <polyline
        points={pts}
        fill="none"
        stroke="#d4d4d8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="180"
        cy={46 - (SPARK[SPARK.length - 1] / max) * 40}
        r="3"
        fill="#ffffff"
      />
    </svg>
  );
}

export default function HeroC({ stats }: { stats: ChainStats }) {
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
          <a href="#issue" className="pill-metal">
            Start issuing — free
          </a>
          <a href="#verify" className="pill-ghost">
            Verify a certificate
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
          <p className="text-xs text-ash">Certificates sealed</p>
          <p className="mt-1.5 text-3xl font-semibold tracking-tight text-vellum">
            1,024
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-candle">
            +412 from latest batch
          </p>
          <div className="mt-3">
            <Spark />
          </div>
        </div>

        <div className="glass-card col-span-2 p-5 md:col-span-3">
          <p className="text-xs text-ash">Verification checks</p>
          <p className="mt-1.5 text-3xl font-semibold tracking-tight text-vellum">
            2,381
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-ash">
            past 30 days · no logins required
          </p>
          <div className="mt-4 flex h-10 items-end gap-1.5">
            {BARS.map((b, i) => (
              <span
                key={i}
                className="w-full rounded-sm bg-vellum/20"
                style={{
                  height: `${(b / 24) * 100}%`,
                  backgroundColor:
                    i === BARS.length - 1 ? "#ffffff" : undefined,
                }}
              />
            ))}
          </div>
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
            tx 4c69c26d…78d6
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
          <p className="text-xs text-ash">Recent claims</p>
          <ul className="mt-3 divide-y divide-vellum/8">
            {CLAIMS.map((c) => (
              <li key={c.n} className="flex items-center gap-3 py-2.5">
                <span className="grid size-7 place-items-center rounded-full bg-sealwax font-mono text-[9px] text-candle-bright">
                  {c.n.split(" ").map((w) => w[0])}
                </span>
                <span className="text-[13px] font-medium text-vellum">
                  {c.n}
                </span>
                <span className="text-xs text-ash">{c.d}</span>
                <span className="ml-auto font-mono text-[10px] text-ash">
                  {c.t}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card col-span-2 flex items-center gap-5 p-5 md:col-span-5">
          <div className="shrink-0 rounded-lg bg-vellum p-2">
            <div className="grid grid-cols-[repeat(10,4px)] grid-rows-[repeat(10,4px)]">
              {"1110100101101110010100110101110010110101001101011100101101001011010110010110100101101".slice(0, 100)
                .split("")
                .map((bit, i) => (
                  <span
                    key={i}
                    className={bit === "1" ? "bg-vault" : "bg-transparent"}
                  />
                ))}
            </div>
          </div>
          <div>
            <p className="text-[13px] font-medium text-vellum">
              Every certificate ships with its QR
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ash">
              Scan → live check against the chain. Valid, revoked, or tampered
              — in one second.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
