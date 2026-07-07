import type { Metadata } from "next";
import { Inter, Fragment_Mono } from "next/font/google";
import "./globals.css";

/* Cryptgen-clone direction: Inter carries the whole page */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

/* data voice (hashes, tx ids) stays mono */
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
    <html lang="en" className={`${inter.variable} ${fragment.variable}`}>
      <body className="grain">{children}</body>
    </html>
  );
}
