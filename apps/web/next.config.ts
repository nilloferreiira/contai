import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@contai/api", "@contai/db", "@contai/domain"],
  // Lets the dev server's HMR/internal requests through from another host
  // (e.g. a LAN IP when testing on a phone) — off by default, since Next.js
  // blocks those requests from any origin but localhost otherwise. Set
  // DEV_ALLOWED_ORIGIN in your own untracked apps/web/.env.local (e.g.
  // DEV_ALLOWED_ORIGIN=192.168.0.13) rather than hardcoding it here.
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  ...(process.env.DEV_ALLOWED_ORIGIN ? { allowedDevOrigins: [process.env.DEV_ALLOWED_ORIGIN] } : {}),
};

export default nextConfig;
