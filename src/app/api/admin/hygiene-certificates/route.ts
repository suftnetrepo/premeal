import { NextResponse } from "next/server";
import { requireAdmin, isFailure } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import type { HygieneCertificateStatus } from "@prisma/client";

const VALID_STATUSES = ["PENDING", "VERIFIED", "REJECTED"];

/**
 * Deliberately separate from GET /api/admin/restaurants — that route (and
 * its filter buttons) is scoped to Restaurant.approvalStatus, the
 * new-signup approval queue. A restaurant can submit a hygiene
 * certificate at any point in its life, long after being approved, so
 * this is its own queue keyed on hygieneCertificateStatus instead.
 * Restaurants that have never submitted one (status null) are excluded
 * by every filter here, including "ALL" — there's nothing to review for
 * a restaurant that hasn't submitted anything.
 */
export async function GET(request: Request) {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status =
    statusParam && VALID_STATUSES.includes(statusParam) ? (statusParam as HygieneCertificateStatus) : undefined;

  const restaurants = await prisma.restaurant.findMany({
    where: status ? { hygieneCertificateStatus: status } : { hygieneCertificateStatus: { not: null } },
    include: { owner: true },
    orderBy: { hygieneCertificateSubmittedAt: "desc" },
  });

  return NextResponse.json({ restaurants });
}
