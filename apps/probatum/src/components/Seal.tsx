/**
 * The wax seal — Probatum's signature mark. Scalloped medallion, the
 * shape wax actually takes when a stamp presses it: petals of overflow
 * around a compressed center.
 *
 * Layers the Hero timeline animates (attribute names are a contract):
 *   [data-seal-stamp]   the brass stamp, descends from above
 *   [data-seal-wax]     the wax medallion, squashes on contact
 *   [data-seal-imprint] the PROBATUM EST ring + star, revealed by the press
 *   [data-seal-flash]   one ring of light at the moment of contact
 */

const CX = 220;
const CY = 304;

/* 12 scallops with hand-jittered radii/positions — wax is never regular */
const SCALLOPS = [
  { a: 0, r: 27, d: 88 },
  { a: 30, r: 24, d: 90 },
  { a: 60, r: 28, d: 86 },
  { a: 90, r: 25, d: 91 },
  { a: 120, r: 26, d: 87 },
  { a: 150, r: 23, d: 89 },
  { a: 180, r: 28, d: 88 },
  { a: 210, r: 25, d: 86 },
  { a: 240, r: 27, d: 90 },
  { a: 270, r: 24, d: 88 },
  { a: 300, r: 26, d: 91 },
  { a: 330, r: 25, d: 87 },
].map(({ a, r, d }) => {
  const rad = (a * Math.PI) / 180;
  return {
    cx: +(CX + d * Math.cos(rad)).toFixed(1),
    cy: +(CY + d * Math.sin(rad)).toFixed(1),
    r,
  };
});

export default function Seal() {
  return (
    <svg
      viewBox="0 0 440 460"
      className="h-full w-auto"
      role="img"
      aria-label="A brass stamp pressing a scalloped wax seal that reads Probatum Est"
    >
      <defs>
        <radialGradient id="waxBody" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#c22e4d" />
          <stop offset="42%" stopColor="#a3243f" />
          <stop offset="78%" stopColor="#7c1830" />
          <stop offset="100%" stopColor="#4d0e1e" />
        </radialGradient>
        <radialGradient id="waxPool" cx="44%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#8f1f38" />
          <stop offset="80%" stopColor="#6b142a" />
          <stop offset="100%" stopColor="#560f21" />
        </radialGradient>
        <radialGradient id="waxSheen" cx="34%" cy="22%" r="46%">
          <stop offset="0%" stopColor="#ffe9b8" stopOpacity="0.32" />
          <stop offset="60%" stopColor="#f2c56b" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#f2c56b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2c56b" />
          <stop offset="45%" stopColor="#d9a441" />
          <stop offset="100%" stopColor="#7c5a1d" />
        </linearGradient>
        <radialGradient id="flash" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe9b8" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#d9a441" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#d9a441" stopOpacity="0" />
        </radialGradient>
        <path
          id="sealRing"
          d="M 220 240 m -56 0 a 56 56 0 1 1 112 0 a 56 56 0 1 1 -112 0"
        />
      </defs>

      {/* contact flash */}
      <circle
        data-seal-flash
        cx={CX}
        cy={CY}
        r="150"
        fill="url(#flash)"
        opacity="0"
      />

      <g data-seal-wax style={{ transformOrigin: `${CX}px ${CY + 14}px` }}>
        {/* pooled shadow beneath the wax */}
        <ellipse cx={CX} cy={CY + 92} rx="112" ry="12" fill="#000" opacity="0.5" />

        {/* scalloped body: overflow petals + main disc, one material */}
        <g fill="url(#waxBody)">
          {SCALLOPS.map((s, i) => (
            <circle key={i} cx={s.cx} cy={s.cy} r={s.r} />
          ))}
          <circle cx={CX} cy={CY} r="96" />
        </g>

        {/* compressed pool where the stamp lands */}
        <circle cx={CX} cy={CY} r="72" fill="url(#waxPool)" />
        <circle
          cx={CX}
          cy={CY}
          r="72"
          fill="none"
          stroke="#3f0a17"
          strokeOpacity="0.55"
          strokeWidth="2.5"
        />

        {/* candlelight sheen across the wax */}
        <circle cx={CX} cy={CY} r="96" fill="url(#waxSheen)" />

        {/* one drip, bottom-right — wax obeys gravity */}
        <circle cx="298" cy="366" r="11" fill="url(#waxBody)" />

        {/* imprint pressed into the wax */}
        <g
          data-seal-imprint
          opacity="0"
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        >
          <circle
            cx={CX}
            cy={CY}
            r="64"
            fill="none"
            stroke="#f6d27c"
            strokeOpacity="0.6"
            strokeWidth="1.5"
          />
          <circle
            cx={CX}
            cy={CY}
            r="57"
            fill="none"
            stroke="#f6d27c"
            strokeOpacity="0.28"
            strokeWidth="0.75"
          />
          {/* four-point star — the Stellar nod */}
          <path
            d={`M ${CX} ${CY - 26} L ${CX + 6} ${CY - 6} L ${CX + 26} ${CY} L ${CX + 6} ${CY + 6} L ${CX} ${CY + 26} L ${CX - 6} ${CY + 6} L ${CX - 26} ${CY} L ${CX - 6} ${CY - 6} Z`}
            fill="#f6d27c"
            fillOpacity="0.8"
          />
          <g transform={`translate(0, ${CY - 240})`}>
            <text
              fontSize="12"
              letterSpacing="4"
              fill="#f6d27c"
              fillOpacity="0.72"
              style={{ fontFamily: "var(--font-fragment)" }}
            >
              <textPath href="#sealRing" startOffset="2%">
                PROBATUM · EST · PROBATUM · EST ·
              </textPath>
            </text>
          </g>
        </g>
      </g>

      {/* the brass stamp — tall, slender, ceremonial */}
      <g data-seal-stamp>
        <circle cx={CX} cy="10" r="9" fill="url(#brass)" />
        <rect x="209" y="14" width="22" height="88" rx="10" fill="url(#brass)" />
        {/* knurled grip band */}
        <rect x="206" y="52" width="28" height="3" rx="1.5" fill="#7c5a1d" />
        <rect x="206" y="59" width="28" height="3" rx="1.5" fill="#7c5a1d" />
        <rect x="206" y="66" width="28" height="3" rx="1.5" fill="#7c5a1d" />
        {/* neck flare */}
        <path
          d="M 213 100 C 213 122 192 126 186 140 L 254 140 C 248 126 227 122 227 100 Z"
          fill="url(#brass)"
        />
        {/* base plate — matches the pool it presses */}
        <rect x="150" y="140" width="140" height="22" rx="10" fill="url(#brass)" />
        <ellipse cx={CX} cy="163" rx="68" ry="6" fill="#7c5a1d" />
      </g>
    </svg>
  );
}
