import type { NextConfig } from "next";

const config: NextConfig = {
  // postgres.js opens real sockets; it must not be bundled.
  serverExternalPackages: ["postgres"],
};

export default config;
