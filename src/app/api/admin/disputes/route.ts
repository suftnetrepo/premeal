import { NextResponse } from "next/server";
import { requireAdmin, isFailure } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;

  const { searchParams } = new URL(request.url);
  const showResolved = searchParams.get("resolved") === "true";

  const orders = await prisma.order.findMany({
    where: showResolved ? { disputedAt: { not: null } } : { disputedAt: { not: null }, disputeResolvedAt: null },
    include: { customer: true, restaurant: true, items: true },
    orderBy: { disputedAt: "desc" },
  });

  return NextResponse.json({ orders });
}
