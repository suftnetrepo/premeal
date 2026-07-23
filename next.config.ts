import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      // TEMP — for the placeholder hero image only (src/app/page.tsx).
      // Remove once that's swapped for a real licensed photo.
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
