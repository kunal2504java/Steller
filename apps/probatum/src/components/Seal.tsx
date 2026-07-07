/**
 * The wax seal — Probatum's signature mark.
 *
 * Three layers the Hero timeline animates:
 *   [data-seal-stamp]   the brass stamp, descends from above
 *   [data-seal-wax]     the molten wax blob, squashes on contact
 *   [data-seal-imprint] the PROBATUM EST ring + star, revealed by the press
 *   [data-seal-flash]   one ring of light at the moment of contact
 */
export default function Seal() {
  return (
    <svg
      viewBox="0 0 440 460"
      className="h-full w-auto"
      role="img"
      aria-label="A brass stamp pressing a wax seal that reads Probatum Est"
    >
      <defs>
        <radialGradient id="waxBody" cx="42%" cy="34%" r="75%">
          <stop offset="0%" stopColor="#a3283a" />
          <stop offset="55%" stopColor="#7e1f2b" />
          <stop offset="100%" stopColor="#511219" />
        </radialGradient>
        <radialGradient id="waxSheen" cx="38%" cy="26%" r="40%">
          <stop offset="0%" stopColor="#f2c56b" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f2c56b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2c56b" />
          <stop offset="45%" stopColor="#d9a441" />
          <stop offset="100%" stopColor="#8a6420" />
        </linearGradient>
        <radialGradient id="flash" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f2c56b" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#d9a441" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#d9a441" stopOpacity="0" />
        </radialGradient>
        <path
          id="sealRing"
          d="M 220 218 m -64 0 a 64 64 0 1 1 128 0 a 64 64 0 1 1 -128 0"
        />
      </defs>

      {/* contact flash */}
      <circle
        data-seal-flash
        cx="220"
        cy="310"
        r="150"
        fill="url(#flash)"
        opacity="0"
      />

      {/* wax blob — irregular on purpose; wax is never a perfect circle */}
      <g data-seal-wax style={{ transformOrigin: "220px 318px" }}>
        {/* pooled shadow beneath the wax */}
        <ellipse cx="220" cy="392" rx="104" ry="11" fill="#000" opacity="0.45" />
        <path
          d="M 220 224
             C 268 220 312 246 318 292
             C 324 336 300 372 262 384
             C 236 392 200 394 172 384
             C 132 370 112 336 120 296
             C 128 252 172 228 220 224 Z"
          fill="url(#waxBody)"
        />
        <path
          d="M 220 224
             C 268 220 312 246 318 292
             C 324 336 300 372 262 384
             C 236 392 200 394 172 384
             C 132 370 112 336 120 296
             C 128 252 172 228 220 224 Z"
          fill="url(#waxSheen)"
        />
        {/* candlelight rim catching the wax edge */}
        <path
          d="M 220 224
             C 268 220 312 246 318 292
             C 324 336 300 372 262 384
             C 236 392 200 394 172 384
             C 132 370 112 336 120 296
             C 128 252 172 228 220 224 Z"
          fill="none"
          stroke="#f2c56b"
          strokeOpacity="0.22"
          strokeWidth="1.5"
        />
        {/* imprint pressed into the wax */}
        <g data-seal-imprint opacity="0" style={{ transformOrigin: "220px 304px" }}>
          <circle
            cx="220"
            cy="304"
            r="78"
            fill="none"
            stroke="#f2c56b"
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
          <circle
            cx="220"
            cy="304"
            r="70"
            fill="none"
            stroke="#f2c56b"
            strokeOpacity="0.3"
            strokeWidth="0.75"
          />
          {/* four-point star — the Stellar nod */}
          <path
            d="M 220 272 L 227 297 L 252 304 L 227 311 L 220 336 L 213 311 L 188 304 L 213 297 Z"
            fill="#f2c56b"
            fillOpacity="0.75"
          />
          <g transform="translate(0, 86)">
            <text
              fontSize="13.5"
              letterSpacing="4.5"
              fill="#f2c56b"
              fillOpacity="0.7"
              style={{ fontFamily: "var(--font-jetmono)" }}
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
        {/* finial */}
        <circle cx="220" cy="10" r="9" fill="url(#brass)" />
        {/* handle */}
        <rect x="209" y="14" width="22" height="92" rx="10" fill="url(#brass)" />
        {/* neck flare */}
        <path
          d="M 213 104 C 213 124 194 128 190 142 L 250 142 C 246 128 227 124 227 104 Z"
          fill="url(#brass)"
        />
        {/* base plate */}
        <rect x="164" y="142" width="112" height="20" rx="9" fill="url(#brass)" />
        <ellipse cx="220" cy="163" rx="54" ry="5.5" fill="#8a6420" />
      </g>
    </svg>
  );
}
