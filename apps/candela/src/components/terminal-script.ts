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
