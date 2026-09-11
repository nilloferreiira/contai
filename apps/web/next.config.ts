import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@contai/db", "@contai/domain"],
};

export default nextConfig;
