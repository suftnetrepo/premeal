import { NextResponse } from "next/server";
import { requireDriver, isFailure } from "@/lib/driver-auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const result = await requireDriver();
  if (isFailure(result)) return result.error;

  const requests = await prisma.restaurantDriver.findMany({
    where: { driverId: result.user.id, status: "PENDING" },
    include: { restaurant: { select: { id: true, name: true, cuisine: true } } },
    orderBy: { invitedAt: "desc" },
  });

  return NextResponse.json({ requests });
}
