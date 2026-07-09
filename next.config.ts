import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server (.next/standalone) so the desktop build
  // can ship it as a Node sidecar launched by Tauri.
  output: "standalone",
  // Keep the desktop build's staged resources, uploaded files, and the Rust
  // target out of Next's file trace — otherwise standalone recursively copies
  // the previous build's bundle into the new one.
  outputFileTracingExcludes: {
    "*": [
      "src-tauri/**",
      "uploads/**",
      ".next/standalone/**",
    ],
  },
  experimental: {
    // Allow uploading PDFs/EPUBs through Server Actions.
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // jsdom / bcryptjs are server-only; keep them out of the client bundle.
  serverExternalPackages: ["jsdom", "@mozilla/readability"],
};

export default nextConfig;
