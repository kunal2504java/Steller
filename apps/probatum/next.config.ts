import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["candela-kit"],
  // pin the tracing root — a stray lockfile in the user home dir otherwise
  // makes Next guess the wrong workspace root
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
