import type { HygieneCertificateLevel } from "@prisma/client";

// Full, descriptive labels — used on the restaurant-facing submission
// form and the admin review queue, where the distinction between levels
// actually matters to the person choosing/reviewing one.
export const HYGIENE_CERTIFICATE_LEVEL_LABELS: Record<HygieneCertificateLevel, string> = {
  LEVEL_1: "Level 1 — Introduction",
  LEVEL_2: "Level 2 — Food Handlers",
  LEVEL_3: "Level 3 — Supervisory",
  LEVEL_4: "Level 4 — Managerial",
};

// Short form — the actual customer-facing badge text ("Level 2 Food
// Hygiene Certified"), deliberately shorter than the labels above since
// a customer doesn't need "Supervisory"/"Managerial" to trust the claim,
// just the level number.
export function hygieneCertificateBadgeText(level: HygieneCertificateLevel): string {
  const n = level.replace("LEVEL_", "");
  return `Level ${n} Food Hygiene Certified`;
}
