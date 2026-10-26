import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";

// Built at request time (DB-backed); re-generated at most hourly.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/how-it-works"), changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/food-safety"), changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/signup"), changeFrequency: "yearly", priority: 0.5 },
    { url: absoluteUrl("/login"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];

  let restaurantPages: MetadataRoute.Sitemap = [];
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { isActive: true, approvalStatus: "APPROVED", signupFeePaidAt: { not: null } },
      select: { id: true, createdAt: true },
    });
    restaurantPages = restaurants.map((r) => ({
      url: absoluteUrl(`/restaurants/${r.id}`),
      lastModified: r.createdAt,
      changeFrequency: "daily",
      priority: 0.9,
    }));
  } catch {
    // DB unreachable (e.g. during a build): still serve the static entries.
  }

  return [...staticPages, ...restaurantPages];
}
