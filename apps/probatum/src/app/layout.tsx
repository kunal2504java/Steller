import type { Metadata } from "next";
import { Schibsted_Grotesk, Fragment_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

/* Zodiak (ITF via Fontshare) — self-hosted; a serif AI hasn't chewed on */
const zodiak = localFont({
  src: [
    {
      path: "../fonts/Zodiak-Variable.woff2",
      weight: "400 900",
      style: "normal",
    },
    {
      path: "../fonts/Zodiak-VariableItalic.woff2",
      weight: "400 900",
      style: "italic",
    },
  ],
  variable: "--font-zodiak",
});

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
});

const fragment = Fragment_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-fragment",
});

export const metadata: Metadata = {
  title: "Probatum — certificates that can't be faked",
  description:
    "Seal certificates on Stellar. Anyone can verify them, forever — even if the issuer, or we, disappear. Free for hackathons, fests, academies and the 99% of issuers DigiLocker forgot.",
  metadataBase: new URL("https://probatum.app"),
  openGraph: {
    title: "Probatum — certificates that can't be faked",
    description:
      "Sealed on Stellar. Verifiable by anyone, forever. PROBATUM EST.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${zodiak.variable} ${schibsted.variable} ${fragment.variable}`}
    >
      <body className="grain">{children}</body>
    </html>
  );
}
