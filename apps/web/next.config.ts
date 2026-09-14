import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@contai/api", "@contai/db", "@contai/domain"],
};

export default nextConfig;
