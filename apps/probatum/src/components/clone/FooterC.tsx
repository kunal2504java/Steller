import type { ChainStats } from "@/lib/chain";

const COLS: { head: string; links: { label: string; href: string }[] }[] = [
  {
    head: "Product",
    links: [
      { label: "Issue certificates", href: "#issue" },
      { label: "Verify one", href: "#verify" },
      { label: "How sealing works", href: "#proof" },
    ],
  },
  {
    head: "Builders",
    links: [
      { label: "Candela kit", href: "https://github.com/kunal2504java/Steller" },
      { label: "GitHub", href: "https://github.com/kunal2504java/Steller" },
      { label: "MIT license", href: "https://github.com/kunal2504java/Steller/blob/main/LICENSE" },
    ],
  },
  {
    head: "Trust",
    links: [
      { label: "Contract on-chain", href: "__CONTRACT__" },
      { label: "Open events", href: "__CONTRACT__" },
      { label: "Revocation policy", href: "#verify" },
    ],
  },
];

export default function FooterC({ stats }: { stats: ChainStats }) {
  return (
    <footer className="relative">
      {/* hairline with a center glow — straight from the reference */}
      <div className="relative h-px w-full bg-vellum/10">
        <div className="absolute left-1/2 top-0 h-px w-64 -translate-x-1/2 bg-gradient-to-r from-transparent via-candle/70 to-transparent" />
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[minmax(0,5fr)_repeat(3,minmax(0,2fr))]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-sealwax-hot via-sealwax to-[#4d0e1e]">
              <svg viewBox="0 0 20 20" className="size-3.5">
                <path
                  d="M 10 2 L 12 8 L 18 10 L 12 12 L 10 18 L 8 12 L 2 10 L 8 8 Z"
                  fill="#f2c56b"
                />
              </svg>
            </span>
            <span className="text-sm font-semibold tracking-tight text-vellum">
              Probatum
            </span>
          </div>
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-ash">
            Unforgeable certificates for the 99% of issuers DigiLocker forgot.
          </p>
          <p className="mt-6 font-mono text-[10px] tracking-[0.14em] text-ash/70">
            PROVEN ON STELLAR · {stats.network.toUpperCase()} · BUILT IN INDIA
          </p>
        </div>

        {COLS.map((col) => (
          <nav key={col.head}>
            <p className="text-[13px] font-semibold text-vellum">{col.head}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href === "__CONTRACT__" ? stats.contractUrl : l.href}
                    className="text-[13px] text-ash transition-colors hover:text-vellum"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
