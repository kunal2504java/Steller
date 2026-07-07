import type { Metadata } from "next";
import { Fraunces, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
});

const jetmono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetmono",
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
      className={`${fraunces.variable} ${grotesk.variable} ${jetmono.variable}`}
    >
      <body className="grain">{children}</body>
    </html>
  );
}
