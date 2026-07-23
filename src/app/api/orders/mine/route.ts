import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { customerId: user.id },
    include: { items: true, restaurant: true, slot: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}
