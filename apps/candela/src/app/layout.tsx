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
