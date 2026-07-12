# Candela Dev Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `apps/candela` — a polished, on-brand developer landing page for the Candela passkey kit, with a scripted terminal animation, click-to-copy install, live on-chain proof, and Probatum as the flagship use case; and make `candela-kit` publish-ready (actual `npm publish` gated on explicit user go).

**Architecture:** A new Next.js 15 App-Router app mirroring `apps/probatum`'s toolchain and the monochrome "Cryptgen-clone" design system (copied verbatim as the starting point — two apps, two domains, no premature shared-ui package). Logic-bearing units (chain reader, terminal script, copy behavior) are pure and unit-tested with Vitest; visual sections are verified by typecheck + build + render. `candela-kit` gets a real build (tsup) + packaging so its install command is genuine once published.

**Tech Stack:** Next 15.5.6, React 19.2.0, Tailwind v4 (4.1.16), GSAP 3.13.0 + @gsap/react 2.1.2, Lenis 1.3.11, @stellar/stellar-sdk 14.6.1, TypeScript ^5.9.3, Vitest 2 (app unit tests), tsup (kit build).

## Global Constraints

Every task's requirements implicitly include this section. Exact values, copied from the spec (`docs/superpowers/specs/2026-07-12-candela-page-and-viral-loop-design.md`) and the repo:

- **Toolchain pins (do not drift):** Next `15.5.6`, React/React-DOM `19.2.0`, Tailwind + `@tailwindcss/postcss` `4.1.16`, `gsap` `3.13.0`, `@gsap/react` `2.1.2`, `lenis` `1.3.11`, `@stellar/stellar-sdk` `14.6.1`, TypeScript `^5.9.3`.
- **Design system:** monochrome Cryptgen tokens only. Fonts: **Inter** (body/headings — the clone's design font) + **Fragment Mono** (data/code voice). No other fonts. No AI-default faces.
- **Real artifacts only** (from Plan 2 T7, public testnet — safe to hardcode as display strings):
  - smart wallet `CD67ZP6EXIQTFILVEMB6JIFJ47TVIGMKUA7JDY4A2YBMRABZNDYWWXIG`
  - sponsored tx `2da1289548f8227342ce70fa46225572dfd50d6adbb3af5b650dfee385caf484`
  - contract id / genesis tx come from `deployments/testnet.json` (single source of truth) — never hardcode the contract id in a component.
- **Regulatory (page copy must not violate):** no fiat/INR, no custody, no purchasable/tradeable tokens, no PII. Candela is onboarding UX; it moves no money.
- **Secrets:** none committed, ever. No `.env` values in code, plan, or commits.
- **Reduced motion:** every animation degrades to a static, complete final frame under `prefers-reduced-motion: reduce`.
- **Windows / PowerShell 5.1:** write files BOM-less; guard native-exe calls with `$LASTEXITCODE`; **never** run `next build` while a dev server shares `.next` (manifest corruption); the Candela dev server runs on **port 3001** (`next dev -p 3001`) so it never collides with Probatum on 3000 — after killing a dev server, check `Get-NetTCPConnection -LocalPort 3001` for an orphaned node child.
- **App/package names:** app package name `candela-web` (mirrors `probatum-web`); kit stays `candela-kit` (scope fallback `@candela/kit` only if the npm name is taken — decided at publish time).

---

## File Structure

New app `apps/candela/`:

- `package.json` — `candela-web`, deps mirror `apps/probatum` + Vitest devDeps.
- `next.config.ts` — `outputFileTracingRoot` pinned to repo root; `reactStrictMode`.
- `tsconfig.json`, `postcss.config.mjs`, `next-env.d.ts` — copied from probatum.
- `vitest.config.ts` — jsdom env for the app's unit tests.
- `src/app/globals.css` — the monochrome design tokens + primitives, copied from probatum, plus a small `.term-*` block for the terminal.
- `src/app/layout.tsx` — Inter + Fragment Mono, Candela metadata, `grain` body.
- `src/app/page.tsx` — composes the sections inside `SmoothScroll`.
- `src/components/SmoothScroll.tsx`, `src/components/ScrollFX.tsx` — copied verbatim (Lenis one-clock + GSAP `[data-reveal]`).
- `src/components/CopyButton.tsx` — click-to-copy install pill (client).
- `src/components/NavPill.tsx` — Candela nav.
- `src/components/Hero.tsx` — thesis headline + CTAs.
- `src/components/terminal-script.ts` — pure, testable script + frame logic.
- `src/components/Terminal.tsx` — animated terminal (client) consuming the script.
- `src/components/HowItWorks.tsx` — 3 mechanism steps + real snippets.
- `src/components/UseCase.tsx` — "Built with Candela → Probatum" (consumes chain stats).
- `src/components/WhyItMatters.tsx` — open-source / RFP-demand section.
- `src/components/Finale.tsx` — arc finale + footer.
- `src/lib/chain.ts` — read-only chain stats + links from `deployments/testnet.json`.
- `src/lib/__tests__/chain.test.ts`, `src/components/__tests__/terminal-script.test.ts`, `src/components/__tests__/copy.test.ts` — unit tests.

Modified: `packages/candela-kit/package.json` (+ `tsup.config.ts`, `LICENSE`) in Task 8.

---

## Task 1: Scaffold `apps/candela` (config + shell + Vitest)

**Files:**
- Create: `apps/candela/package.json`, `apps/candela/next.config.ts`, `apps/candela/tsconfig.json`, `apps/candela/postcss.config.mjs`, `apps/candela/next-env.d.ts`, `apps/candela/vitest.config.ts`
- Create: `apps/candela/src/app/globals.css`, `apps/candela/src/app/layout.tsx`, `apps/candela/src/app/page.tsx`
- Create: `apps/candela/src/components/SmoothScroll.tsx`, `apps/candela/src/components/ScrollFX.tsx`

**Interfaces:**
- Produces: a rendering Next app on port 3001; `SmoothScroll` (default export, `{children}`) and `ScrollFX` (default export, no props) for later tasks; the full design-token stylesheet.

- [ ] **Step 1: Create `apps/candela/package.json`** (mirror probatum + Vitest)

```json
{
  "name": "candela-web",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "@gsap/react": "2.1.2",
    "@stellar/stellar-sdk": "14.6.1",
    "gsap": "3.13.0",
    "lenis": "1.3.11",
    "next": "15.5.6",
    "react": "19.2.0",
    "react-dom": "19.2.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.1.16",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "jsdom": "^25",
    "tailwindcss": "4.1.16",
    "typescript": "^5.9.3",
    "vitest": "^2"
  }
}
```

- [ ] **Step 2: Copy config files from probatum verbatim**

`apps/candela/next.config.ts` — identical to `apps/probatum/next.config.ts` (the `outputFileTracingRoot: path.join(__dirname, "../../")` pin is correct from `apps/candela` too).
`apps/candela/tsconfig.json` — identical to `apps/probatum/tsconfig.json`.
`apps/candela/postcss.config.mjs` — identical.
`apps/candela/next-env.d.ts` — copy from probatum (or `/// <reference types="next" />` + `/// <reference types="next/image-types/global" />`).

`apps/candela/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

- [ ] **Step 3: Copy the design system** — `apps/candela/src/app/globals.css` is a verbatim copy of `apps/probatum/src/app/globals.css` (all `@theme` tokens + `.fade-title`, `.eyebrow`, `.pill-metal`, `.pill-ghost`, `.glass-card`, `.grid-bg`, `.arc-glow`, `.arc-rim`, `.orbit-*`, `.dot-field`, `.grain`, reduced-motion blocks). Append this terminal block at the end:

```css
/* ── terminal (Candela hero centerpiece) ───────────────────────── */
.term {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  line-height: 1.7;
}
.term-dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 9999px;
}
.term-caret {
  display: inline-block;
  width: 0.55ch;
  height: 1.05em;
  translate: 0 0.16em;
  background: var(--color-vellum);
  animation: term-blink 1s steps(1) infinite;
}
@keyframes term-blink {
  50% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .term-caret { animation: none; opacity: 0; }
}
```

- [ ] **Step 4: Copy `SmoothScroll.tsx` and `ScrollFX.tsx`** into `apps/candela/src/components/` verbatim from `apps/probatum/src/components/SmoothScroll.tsx` and `apps/probatum/src/components/clone/ScrollFX.tsx` (no changes — the one-clock Lenis+GSAP idiom and the `[data-reveal]` reveal system are reused as-is).

- [ ] **Step 5: Create `apps/candela/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter, Fragment_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fragment = Fragment_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-fragment",
});

export const metadata: Metadata = {
  title: "Candela — Web3 UX should not suck",
  description:
    "Passkey onboarding for Stellar. No seed phrase, no browser extension, no gas. One React kit: passkey → smart wallet → sponsored transaction.",
  metadataBase: new URL("https://candela.dev"),
  openGraph: {
    title: "Candela — passkey onboarding for Stellar",
    description:
      "No seed phrase, no extension, no gas. npm i candela-kit.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fragment.variable}`}>
      <body className="grain">{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Create a placeholder `apps/candela/src/app/page.tsx`**

```tsx
import SmoothScroll from "@/components/SmoothScroll";
import ScrollFX from "@/components/ScrollFX";

export default function Home() {
  return (
    <SmoothScroll>
      <ScrollFX />
      <main className="grid min-h-screen place-items-center">
        <p className="eyebrow text-ash">Candela — scaffolding</p>
      </main>
    </SmoothScroll>
  );
}
```

- [ ] **Step 7: Install and verify render**

Run (from repo root): `pnpm install` then `pnpm --filter candela-web dev`
Expected: dev server on `http://localhost:3001`; `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001` → `200`; page is true black with the eyebrow text. **Stop the dev server before any `next build`.**

- [ ] **Step 8: Commit**

```bash
git add apps/candela pnpm-lock.yaml
git commit -m "feat(candela-web): scaffold app shell — config, design tokens, smooth-scroll"
```

---

## Task 2: `lib/chain.ts` — on-chain stats + links

**Files:**
- Create: `apps/candela/src/lib/chain.ts`
- Test: `apps/candela/src/lib/__tests__/chain.test.ts`

**Interfaces:**
- Consumes: `deployments/testnet.json` (`contractId`, `network`, `genesisTx`).
- Produces: `type ChainStats = { wallets: string; sponsoredTxns: string; network: string; contractUrl: string; genesisTx: string }`; `async getChainStats(): Promise<ChainStats>` (fails soft to em-dashes). Used by `UseCase` (Task 6) and `Finale` (Task 7).

Note: Candela's page surfaces developer-flavored numbers (smart wallets created, sponsored txns) rather than Probatum's batches/claims, but reads the **same** contract counters via simulation and fails soft identically. Reuse probatum's `simulateRead` shape; map `batch_count`→ shown as issuers/products context is not needed here, so this task reads `claim_count` for "sponsored actions" and falls back gracefully. Keep it read-only and `server-only`.

- [ ] **Step 1: Write the failing test** — `apps/candela/src/lib/__tests__/chain.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";

// Force the dynamic stellar-sdk import to throw so we hit the fallback path
// deterministically (no network in unit tests).
vi.mock("@stellar/stellar-sdk", () => {
  throw new Error("no network in unit test");
});

describe("getChainStats", () => {
  it("fails soft to em-dashes and still returns real links", async () => {
    const { getChainStats } = await import("../chain");
    const stats = await getChainStats();
    expect(stats.sponsoredTxns).toBe("—");
    expect(stats.contractUrl).toContain("stellar.expert");
    expect(stats.genesisTx.length).toBeGreaterThan(0);
    expect(stats.network.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter candela-web test`
Expected: FAIL — cannot find module `../chain`.

- [ ] **Step 3: Implement `apps/candela/src/lib/chain.ts`**

```ts
import "server-only";
import deployment from "../../../../deployments/testnet.json";

/**
 * Read-only chain facts for the Candela page. Numbers come from the same
 * live contract Probatum uses — proof the kit is real, not a mock. Fails
 * soft to em-dashes so an RPC hiccup can never break the page.
 */
const CONTRACT_ID = deployment.contractId;
const NETWORK = deployment.network;
const GENESIS_TX = deployment.genesisTx;
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const SIM_SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

export type ChainStats = {
  sponsoredTxns: string;
  network: string;
  contractUrl: string;
  genesisTx: string;
};

const FALLBACK: ChainStats = {
  sponsoredTxns: "—",
  network: NETWORK,
  contractUrl: `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`,
  genesisTx: GENESIS_TX,
};

async function simulateRead(fn: "claim_count"): Promise<bigint> {
  const { Contract, TransactionBuilder, Account, rpc, xdr } = await import(
    "@stellar/stellar-sdk"
  );
  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(new Account(SIM_SOURCE, "0"), {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(fn))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
    throw new Error(`simulation failed for ${fn}`);
  }
  const retval: InstanceType<typeof xdr.ScVal> = sim.result.retval;
  return BigInt(retval.u64().toString());
}

export async function getChainStats(): Promise<ChainStats> {
  try {
    const claims = await simulateRead("claim_count");
    return { ...FALLBACK, sponsoredTxns: claims.toLocaleString("en-IN") };
  } catch {
    return FALLBACK;
  }
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter candela-web test`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/candela/src/lib
git commit -m "feat(candela-web): read-only chain stats with soft fallback + unit test"
```

---

## Task 3: `CopyButton` + `NavPill` + `Hero`

**Files:**
- Create: `apps/candela/src/components/CopyButton.tsx`, `apps/candela/src/components/NavPill.tsx`, `apps/candela/src/components/Hero.tsx`
- Test: `apps/candela/src/components/__tests__/copy.test.ts`

**Interfaces:**
- Produces: `CopyButton` (client; props `{ text: string; className?: string; children?: ReactNode }`) with a pure helper `copyLabel(copied: boolean, base: string): string`; `NavPill` (default, no props); `Hero` (default, no props).
- Consumes: design tokens + `.pill-metal`/`.pill-ghost` from Task 1.

- [ ] **Step 1: Write the failing test** — `apps/candela/src/components/__tests__/copy.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { copyLabel } from "../CopyButton";

describe("copyLabel", () => {
  it("shows the base text when not copied", () => {
    expect(copyLabel(false, "npm i candela-kit")).toBe("npm i candela-kit");
  });
  it("confirms after copy", () => {
    expect(copyLabel(true, "npm i candela-kit")).toBe("copied ✓");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter candela-web test`
Expected: FAIL — cannot find `../CopyButton`.

- [ ] **Step 3: Implement `CopyButton.tsx`**

```tsx
"use client";

import { useState, type ReactNode } from "react";

export function copyLabel(copied: boolean, base: string): string {
  return copied ? "copied ✓" : base;
}

export default function CopyButton({
  text,
  className = "pill-metal",
  children,
}: {
  text: string;
  className?: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const label = children ?? (
    <span className="font-mono">{copyLabel(copied, text)}</span>
  );
  return (
    <button
      type="button"
      className={className}
      aria-label={`Copy ${text}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked — no-op, label unchanged */
        }
      }}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter candela-web test`
Expected: PASS.

- [ ] **Step 5: Implement `NavPill.tsx`** (Candela variant of probatum's NavPill — same wax-dot mark markup, label "Candela", links How it works · Docs · GitHub, right CTA is a CopyButton for the install)

```tsx
import CopyButton from "./CopyButton";

export default function NavPill() {
  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav className="flex w-full max-w-3xl items-center justify-between rounded-full border border-vellum/10 bg-vault/60 py-2 pl-3 pr-2 backdrop-blur-xl">
        <a href="#" className="flex items-center gap-2.5">
          <span className="relative grid size-7 place-items-center rounded-full bg-gradient-to-br from-sealwax-hot via-sealwax to-[#4d0e1e]">
            <svg viewBox="0 0 20 20" className="size-3.5">
              <path
                d="M 10 2 L 12 8 L 18 10 L 12 12 L 10 18 L 8 12 L 2 10 L 8 8 Z"
                fill="#f2c56b"
              />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-vellum">
            Candela
          </span>
        </a>
        <div className="hidden items-center gap-7 text-[13px] font-medium text-ash md:flex">
          <a href="#how" className="transition-colors hover:text-vellum">How it works</a>
          <a href="#usecase" className="transition-colors hover:text-vellum">Use case</a>
          <a
            href="https://github.com/kunal2504java/Steller"
            className="transition-colors hover:text-vellum"
          >
            GitHub
          </a>
        </div>
        <CopyButton
          text="npm i candela-kit"
          className="pill-metal !px-5 !py-2.5 !text-[13px]"
        />
      </nav>
    </div>
  );
}
```

- [ ] **Step 6: Implement `Hero.tsx`** (thesis headline; primary = copy-install; secondary = "See it live →" to the Probatum demo; eyebrow; `data-reveal` staggering like probatum's HeroC)

```tsx
import CopyButton from "./CopyButton";

export default function Hero() {
  return (
    <header className="relative overflow-hidden pb-16 pt-40 md:pt-48">
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
          Open-source passkey kit for Stellar
        </p>
        <h1
          data-reveal
          data-reveal-delay="0.05"
          className="fade-title text-5xl md:text-7xl"
        >
          Web3 UX
          <br />
          should not suck.
        </h1>
        <p
          data-reveal
          className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ash md:text-lg"
        >
          Passkey onboarding for Stellar — no seed phrase, no browser
          extension, no gas. One React kit turns a fingerprint into a smart
          wallet and a sponsored transaction.
        </p>
        <div data-reveal className="mt-9 flex items-center justify-center gap-3">
          <CopyButton text="npm i candela-kit" />
          <a href="https://probatum.app" className="pill-ghost">
            See it live →
          </a>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 7: Verify render** — temporarily mount `NavPill` + `Hero` in `page.tsx`; `pnpm --filter candela-web dev`; confirm `200`, headline reads as the thesis, install pill copies (manual click), reveal animation runs. Restore placeholder or leave mounted for Task 7's compose.

- [ ] **Step 8: Commit**

```bash
git add apps/candela/src/components
git commit -m "feat(candela-web): nav, hero, and click-to-copy install button"
```

---

## Task 4: `Terminal` — the animated centerpiece

**Files:**
- Create: `apps/candela/src/components/terminal-script.ts`, `apps/candela/src/components/Terminal.tsx`
- Test: `apps/candela/src/components/__tests__/terminal-script.test.ts`

**Interfaces:**
- Produces: from `terminal-script.ts`: `REAL_WALLET`, `REAL_TX` (const strings), `SCRIPT_LINES: string[]` (the full rendered sequence), `type Frame = { visibleLines: string[]; done: boolean }`, `initialFrame(reducedMotion: boolean): Frame`. `Terminal` (default export, no props) is a client component.
- Consumes: `.term`, `.term-caret`, `.glass-card` from Task 1.

Design: the terminal renders lines one at a time via a timer in the animated case; under reduced motion it renders every line immediately (`initialFrame(true)`). The pure `initialFrame` + `SCRIPT_LINES` carry all logic, so both branches are unit-testable without React Testing Library or fake timers.

- [ ] **Step 1: Write the failing test** — `apps/candela/src/components/__tests__/terminal-script.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  REAL_WALLET,
  REAL_TX,
  SCRIPT_LINES,
  initialFrame,
} from "../terminal-script";

describe("terminal-script", () => {
  it("ends on the real testnet artifacts (short forms present)", () => {
    const joined = SCRIPT_LINES.join("\n");
    expect(joined).toContain(REAL_WALLET.slice(0, 6));
    expect(joined).toContain(REAL_TX.slice(0, 6));
    expect(joined).toContain("candela-kit");
  });

  it("reduced-motion frame renders every line and is done", () => {
    const f = initialFrame(true);
    expect(f.visibleLines).toEqual(SCRIPT_LINES);
    expect(f.done).toBe(true);
  });

  it("animated frame starts empty and not done", () => {
    const f = initialFrame(false);
    expect(f.visibleLines).toEqual([]);
    expect(f.done).toBe(false);
  });

  it("is deterministic — same output on repeat calls", () => {
    expect(initialFrame(true)).toEqual(initialFrame(true));
    expect(SCRIPT_LINES).toEqual([...SCRIPT_LINES]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter candela-web test`
Expected: FAIL — cannot find `../terminal-script`.

- [ ] **Step 3: Implement `terminal-script.ts`**

```ts
/** Real, public testnet artifacts from Plan 2 T7 — safe to display. */
export const REAL_WALLET =
  "CD67ZP6EXIQTFILVEMB6JIFJ47TVIGMKUA7JDY4A2YBMRABZNDYWWXIG";
export const REAL_TX =
  "2da1289548f8227342ce70fa46225572dfd50d6adbb3af5b650dfee385caf484";

const walletShort = `${REAL_WALLET.slice(0, 6)}…${REAL_WALLET.slice(-4)}`;
const txShort = `${REAL_TX.slice(0, 6)}…${REAL_TX.slice(-4)}`;

/**
 * The rendered console, line by line. An illustrative reenactment of the
 * proven flow — real API names, real artifacts, no live network call.
 * `$ ` prefixes are typed commands; everything else is printed output.
 */
export const SCRIPT_LINES: string[] = [
  "$ pnpm add candela-kit",
  "✓ added candela-kit",
  "",
  "// wrap once, drop a button, submit anywhere",
  "<CandelaProvider config=\"testnet\">",
  "  <SignUpButton />        // Face ID / fingerprint",
  "</CandelaProvider>",
  "",
  "const { submit } = useSubmit();",
  "await submit(registerIssuer);",
  "",
  "→ passkey created",
  `→ smart wallet ${walletShort}`,
  `→ sponsored tx ${txShort}  ✓`,
];

export type Frame = { visibleLines: string[]; done: boolean };

export function initialFrame(reducedMotion: boolean): Frame {
  return reducedMotion
    ? { visibleLines: [...SCRIPT_LINES], done: true }
    : { visibleLines: [], done: false };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter candela-web test`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement `Terminal.tsx`** (reveals lines on an interval; reduced-motion shows the final frame immediately; window-chrome dots; mono; a caret on the last line while typing)

```tsx
"use client";

import { useEffect, useState } from "react";
import { SCRIPT_LINES, initialFrame, type Frame } from "./terminal-script";

function lineClass(line: string): string {
  if (line.startsWith("$")) return "text-vellum";
  if (line.startsWith("✓") || line.trimEnd().endsWith("✓"))
    return "text-candle";
  if (line.startsWith("//")) return "text-ash";
  if (line.startsWith("→")) return "text-parchment";
  return "text-parchment";
}

export default function Terminal() {
  const [frame, setFrame] = useState<Frame>(() => initialFrame(false));

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      setFrame(initialFrame(true));
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setFrame({
        visibleLines: SCRIPT_LINES.slice(0, i),
        done: i >= SCRIPT_LINES.length,
      });
      if (i >= SCRIPT_LINES.length) clearInterval(id);
    }, 380);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative mx-auto max-w-3xl px-6 pb-8">
      <div data-reveal className="glass-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-vellum/8 px-4 py-3">
          <span className="term-dot bg-sealwax-hot/70" />
          <span className="term-dot bg-candle/40" />
          <span className="term-dot bg-vellum/20" />
          <span className="ml-3 font-mono text-[11px] text-ash">
            candela — passkey onboarding
          </span>
        </div>
        <pre className="term min-h-[22rem] overflow-x-auto px-5 py-4">
          {frame.visibleLines.map((line, idx) => {
            const isLast = idx === frame.visibleLines.length - 1;
            return (
              <div key={idx} className={lineClass(line)}>
                {line || " "}
                {!frame.done && isLast && <span className="term-caret" />}
              </div>
            );
          })}
        </pre>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Verify render** — mount `Terminal` under `Hero` in `page.tsx`; `pnpm --filter candela-web dev`; watch the sequence type out to the sponsored-tx line; toggle OS reduced-motion (or emulate in devtools) and confirm the full frame renders instantly with no caret.

- [ ] **Step 7: Commit**

```bash
git add apps/candela/src/components/terminal-script.ts apps/candela/src/components/Terminal.tsx apps/candela/src/components/__tests__/terminal-script.test.ts
git commit -m "feat(candela-web): scripted terminal animation with reduced-motion final frame"
```

---

## Task 5: `HowItWorks` — the mechanism, honestly

**Files:**
- Create: `apps/candela/src/components/HowItWorks.tsx`

**Interfaces:**
- Produces: `HowItWorks` (default export, no props). Consumes `.glass-card`, `.fade-title`, tokens.

- [ ] **Step 1: Implement `HowItWorks.tsx`** — three `glass-card` steps mirroring probatum's `FeatureBento` grid idiom; copy is truthful to the kit's real behavior (passkey→secp256r1 smart wallet; sponsor pays fees; one hook signs+submits). `id="how"` for the nav anchor.

```tsx
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
```

- [ ] **Step 2: Verify render** — mount under `Terminal`; confirm three cards, reveal stagger, mono code blocks legible.

- [ ] **Step 3: Commit**

```bash
git add apps/candela/src/components/HowItWorks.tsx
git commit -m "feat(candela-web): how-it-works — the mechanism in three honest steps"
```

---

## Task 6: `UseCase` — Built with Candela → Probatum

**Files:**
- Create: `apps/candela/src/components/UseCase.tsx`

**Interfaces:**
- Consumes: `getChainStats()` / `ChainStats` from Task 2 (`apps/candela/src/lib/chain.ts`).
- Produces: `UseCase` — an **async server component** (default export, props `{ stats: ChainStats }`). `id="usecase"`.

- [ ] **Step 1: Implement `UseCase.tsx`** — the flagship case study: sells Probatum, shows the live sponsored-txn count + genesis tx from chain, links to the Probatum landing and the contract on stellar.expert.

```tsx
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
            <a href="https://probatum.app" className="pill-metal">
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
```

- [ ] **Step 2: Verify render** — wire `getChainStats()` in `page.tsx` (Task 7 does the final compose; for this step, pass real stats and confirm the number shows live or em-dash, links resolve).

- [ ] **Step 3: Commit**

```bash
git add apps/candela/src/components/UseCase.tsx
git commit -m "feat(candela-web): Probatum use-case block with live on-chain proof"
```

---

## Task 7: `WhyItMatters` + `Finale` + compose full page

**Files:**
- Create: `apps/candela/src/components/WhyItMatters.tsx`, `apps/candela/src/components/Finale.tsx`
- Modify: `apps/candela/src/app/page.tsx`

**Interfaces:**
- Consumes: all prior components; `getChainStats()`.
- Produces: the complete, ordered landing page.

- [ ] **Step 1: Implement `WhyItMatters.tsx`** — open-source / TypeScript / React / live-on-Stellar chips + the RFP-demand line, mirroring the bento stat idiom.

```tsx
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
```

- [ ] **Step 2: Implement `Finale.tsx`** — the arc-glow planet finale (mirror probatum's `CtaFinale` structure) with the install command + GitHub, and a minimal footer.

```tsx
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
```

- [ ] **Step 3: Compose the full `apps/candela/src/app/page.tsx`**

```tsx
import SmoothScroll from "@/components/SmoothScroll";
import ScrollFX from "@/components/ScrollFX";
import NavPill from "@/components/NavPill";
import Hero from "@/components/Hero";
import Terminal from "@/components/Terminal";
import HowItWorks from "@/components/HowItWorks";
import UseCase from "@/components/UseCase";
import WhyItMatters from "@/components/WhyItMatters";
import Finale from "@/components/Finale";
import { getChainStats } from "@/lib/chain";

export const revalidate = 120;

export default async function Home() {
  const stats = await getChainStats();
  return (
    <SmoothScroll>
      <ScrollFX />
      <NavPill />
      <main>
        <Hero />
        <Terminal />
        <HowItWorks />
        <UseCase stats={stats} />
        <WhyItMatters />
        <Finale />
      </main>
    </SmoothScroll>
  );
}
```

- [ ] **Step 4: Verify the whole page** — `pnpm --filter candela-web dev`; scroll top→bottom; confirm: 200, reveal animations fire per section, terminal types, install copies, use-case number is live-or-dash, all links resolve, arc finale renders. Then stop the dev server and run a production build to catch build-only errors: `pnpm --filter candela-web build` (server MUST be stopped first). Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/candela/src/components/WhyItMatters.tsx apps/candela/src/components/Finale.tsx apps/candela/src/app/page.tsx
git commit -m "feat(candela-web): why-it-matters, arc finale, full page compose"
```

---

## Task 8: Make `candela-kit` publish-ready (publish gated)

**Files:**
- Modify: `packages/candela-kit/package.json`
- Create: `packages/candela-kit/tsup.config.ts`, `packages/candela-kit/LICENSE`

**Interfaces:**
- Produces: a built, installable `candela-kit` (dist + types + exports map). No behavior change to the kit's runtime API.

Rationale: the page's `npm i candela-kit` must be real once published. This task builds and packages the kit and verifies the artifact with `npm pack` + a local install smoke — but **does NOT run `npm publish`** (that is outward-facing and gated on explicit user go).

- [ ] **Step 1: Add `tsup` build config** — `packages/candela-kit/tsup.config.ts`

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
});
```

- [ ] **Step 2: Add `LICENSE`** — MIT, `packages/candela-kit/LICENSE` (standard MIT text, copyright holder "Candela contributors", year 2026).

- [ ] **Step 3: Update `packages/candela-kit/package.json`** — drop `private`, add license/exports/files/build, keep dep pins exactly. Add `tsup` to devDependencies (`^8`).

```json
{
  "name": "candela-kit",
  "version": "0.1.0",
  "description": "Passkey onboarding for Stellar — no seed phrase, no extension, no gas. React provider, hooks, and buttons over PasskeyKit + Launchtube.",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "LICENSE", "README.md"],
  "sideEffects": false,
  "keywords": ["stellar", "passkey", "soroban", "smart-wallet", "webauthn", "react"],
  "repository": { "type": "git", "url": "https://github.com/kunal2504java/Steller" },
  "scripts": {
    "build": "tsup",
    "prepublishOnly": "tsup",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@stellar/stellar-base": "14.1.0",
    "@stellar/stellar-sdk": "14.6.1",
    "buffer": "6.0.3",
    "passkey-kit": "0.11.3"
  },
  "peerDependencies": { "react": ">=19" },
  "devDependencies": {
    "@playwright/test": "^1.61",
    "@types/node": "^22",
    "@types/react": "^19",
    "@vitejs/plugin-react": "^4",
    "jsdom": "^25",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "tsup": "^8",
    "typescript": "^5.9.3",
    "vite": "^6",
    "vitest": "^2"
  }
}
```

- [ ] **Step 4: Build and verify the artifact**

Run: `pnpm install` then `pnpm --filter candela-kit build`
Expected: `packages/candela-kit/dist/index.js` + `dist/index.d.ts` produced, no type errors.

Run: `pnpm --filter candela-kit exec npm pack --dry-run`
Expected: the packed file list contains `dist/index.js`, `dist/index.d.ts`, `LICENSE`, `package.json` — and NO `src/`, tests, `.env`, or playground. If `src` or secrets appear, fix `files`.

- [ ] **Step 5: Confirm existing kit tests still pass** (packaging must not disturb behavior)

Run: `pnpm --filter candela-kit test`
Expected: all unit tests PASS (the 3 wallet-state/config/passkey suites).

- [ ] **Step 6: Commit (publish still gated — do NOT run `npm publish`)**

```bash
git add packages/candela-kit/package.json packages/candela-kit/tsup.config.ts packages/candela-kit/LICENSE pnpm-lock.yaml
git commit -m "chore(candela-kit): publish-ready — tsup build, exports, MIT, packed artifact verified (publish gated)"
```

---

## Task 9: Verification pass + polish

**Files:**
- Modify: only as defects require.

- [ ] **Step 1: Full manual verification checklist** (run against `pnpm --filter candela-web dev` on :3001):
  - Page returns `200`; no console errors.
  - Reduced-motion (emulate in devtools): terminal shows final frame instantly, no reveal scrubbing, caret hidden.
  - Mobile viewport (375px): nav collapses cleanly, hero/terminal/cards stack, no horizontal scroll (`overflow-x: clip` holds).
  - Click-to-copy works in nav, hero, finale; label flips to "copied ✓" and back.
  - All external links resolve: Probatum (`https://probatum.app`), GitHub repo, stellar.expert contract.
  - Use-case number renders live (a real integer) or degrades to "—" — never blank, never crashes.
- [ ] **Step 2: Typecheck + lint + build gate**

Run (dev server stopped): `pnpm --filter candela-web build` and `pnpm --filter candela-web test`
Expected: build succeeds; all app unit tests pass.

- [ ] **Step 3: Fix any defects found**, committing each fix with a focused message.

- [ ] **Step 4: Final commit if polish changes were made**

```bash
git add apps/candela
git commit -m "polish(candela-web): verification-pass fixes"
```

---

## Self-Review (author)

- **Spec coverage:** §4.1 architecture → T1; §4.2 sections → Nav/Hero T3, Terminal T4, HowItWorks T5, UseCase T6, WhyItMatters+Finale T7; §4.3 npm publish-readiness → T8 (publish gated, matches "explicit user go" + scope fallback noted in Global Constraints); §4.4 testing → chain test T2, terminal reduced-motion + determinism T4, manual verify T9. Track 2/3 (contract rev + viral loop) are explicitly a later plan, per spec §2 sequencing — not in this plan by design.
- **Placeholder scan:** no TBD/TODO; every code step carries complete code; MIT LICENSE text is standard-and-known (implementer fills the canonical MIT body — the one legitimately templated artifact).
- **Type consistency:** `ChainStats` shape defined in T2 (`sponsoredTxns`, `network`, `contractUrl`, `genesisTx`) is consumed identically in T6/T7; `initialFrame`/`SCRIPT_LINES`/`Frame` defined in T4 script and consumed by T4 component and its test; `copyLabel`/`CopyButton` props defined in T3 and reused in T3/T7.
- **Gated action flagged:** the only outward-facing step (`npm publish`) is deliberately excluded from executable steps and marked gated in Global Constraints, T8 rationale, and T8 Step 6.
