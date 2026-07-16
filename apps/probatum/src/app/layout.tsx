import type { Metadata } from "next";
import { Inter, Fragment_Mono } from "next/font/google";
import { siteOrigin } from "@/lib/site";
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
  title: "Candela — Web3 UX should not suck",
  description:
    "Open-source passkey onboarding for Stellar. No seed phrase, browser extension or user-paid gas.",
  metadataBase: new URL(siteOrigin()),
  openGraph: {
    title: "Candela — passkey onboarding for Stellar",
    description:
      "A fingerprint becomes a smart wallet and a sponsored transaction.",
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
