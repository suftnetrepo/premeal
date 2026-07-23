import { NextResponse } from "next/server";
import { requireAdmin, isFailure } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import type { RestaurantApprovalStatus } from "@prisma/client";

const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

export async function GET(request: Request) {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status =
    statusParam && VALID_STATUSES.includes(statusParam) ? (statusParam as RestaurantApprovalStatus) : undefined;

  const restaurants = await prisma.restaurant.findMany({
    where: status ? { approvalStatus: status } : {},
    include: { owner: true, _count: { select: { menuItems: true, deliverySlots: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ restaurants });
}
