export const SITE_NAME = "Eaneri";
export const SITE_TAGLINE = "Order ahead, eat when you want";
export const SITE_DESCRIPTION =
  "Eaneri is a scheduled food delivery app. Pick a restaurant, choose your delivery day and time window, and the kitchen confirms within 30 minutes. You're only charged once they accept.";
export const SITE_KEYWORDS = [
  "scheduled food delivery",
  "order food ahead",
  "pre-order meals",
  "food delivery",
  "restaurant delivery",
  "meal pre-order",
  "schedule food delivery",
  "Eaneri",
];
export const OG_IMAGE = { url: "/food.png", width: 1254, height: 1254, alt: "A spread of dishes ready for scheduled delivery" };

export function getSiteUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
}

/** Absolute URL for a site path, with no trailing slash on the origin. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, getSiteUrl()).toString();
}

/** Serialises JSON-LD safely for a <script> tag (escapes `<` against XSS). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Pages that must never appear in search results. */
export const NOINDEX = { index: false, follow: false } as const;
