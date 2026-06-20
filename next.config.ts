import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow better-sqlite3 (native module) in server
  serverExternalPackages: ["better-sqlite3"],
  // Enable experimental features
  experimental: {
    // Node.js runtime for API routes that use native modules
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
