import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Render's smaller instances have a tight memory ceiling. Source maps add
  // considerable build-time memory and are not consumed by this application
  // in production, so do not generate them for browser, server, or prerender
  // bundles.
  productionBrowserSourceMaps: false,
  enablePrerenderSourceMaps: false,
  experimental: {
    serverSourceMaps: false,
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,

    // Next normally imports every route when the server starts. Deferring
    // those imports lowers the web service's initial resident memory, which is
    // important on Render; routes are loaded when they are first requested.
    preloadEntriesOnStart: false,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default nextConfig;
