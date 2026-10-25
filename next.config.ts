import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Les plans et pièces peuvent être volumineux.
    serverActions: { bodySizeLimit: "200mb" },
  },
};

export default nextConfig;
