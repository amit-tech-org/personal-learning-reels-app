import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server is often bound on 0.0.0.0 while the browser uses 127.0.0.1.
  // Without this, Next blocks the HMR socket and the dev flight stream never finishes.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
