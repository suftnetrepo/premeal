import { NextResponse } from "next/server";
import { requireDriver, isFailure } from "@/lib/driver-auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const result = await requireDriver();
  if (isFailure(result)) return result.error;

  const orders = await prisma.order.findMany({
    where: {
      driverId: result.user.id,
      status: { in: ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] },
    },
    include: {
      restaurant: { select: { id: true, name: true, address: true } },
      slot: true,
      items: true,
    },
    orderBy: [{ status: "asc" }, { slot: { date: "asc" } }],
    take: 100,
  });

  return NextResponse.json({ orders });
}
