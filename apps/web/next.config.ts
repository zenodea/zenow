import type { NextConfig } from "next";

const config: NextConfig = {
  // postgres.js opens real sockets; it must not be bundled.
  serverExternalPackages: ["postgres"],

  async headers() {
    // Turbopack can reuse a chunk filename across content changes, so a
    // cached asset shadows a rebuild and the page hydrates against stale
    // javascript. Production keeps its immutable hashed-asset caching.
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default config;
