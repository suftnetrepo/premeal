import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/restaurant/",
        "/driver/",
        "/orders",
        "/addresses",
        "/subscribe",
        "/verify-email",
        "/reset-password",
        "/forgot-password",
        "/delete-account",
        "/testing-guide",
        // Filtered/sorted/located homepage variants are duplicates of "/".
        "/?*",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
