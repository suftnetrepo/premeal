import { Award } from "lucide-react";
import { hygieneCertificateBadgeText } from "@/lib/hygiene-certificate";
import type { HygieneCertificateLevel, HygieneCertificateStatus } from "@prisma/client";

/**
 * Shared between the restaurant detail page and the browse/results cards
 * — one place that owns the "only ever VERIFIED, never partial credit"
 * rule, so a card and the detail page can't drift (e.g. one showing a
 * claimed-but-unverified level while the other correctly hides it).
 * Renders nothing at all for pending/rejected/never-submitted, on purpose.
 */
export function HygieneBadge({
  status,
  level,
  size = "md",
}: {
  status: HygieneCertificateStatus | null;
  level: HygieneCertificateLevel | null;
  size?: "sm" | "md";
}) {
  if (status !== "VERIFIED" || !level) return null;

  const sizing =
    size === "sm"
      ? "text-[11px] gap-1 px-2 py-1"
      : "text-xs gap-1.5 px-3 py-1.5";

  return (
    <span
      className={`inline-flex items-center font-medium text-green-700 bg-green-50 border border-green-200 rounded-full ${sizing}`}
    >
      <Award size={size === "sm" ? 11 : 13} strokeWidth={1.75} />
      {hygieneCertificateBadgeText(level)}
    </span>
  );
}
