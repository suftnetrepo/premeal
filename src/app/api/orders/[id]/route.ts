import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { modifiers: true } },
      restaurant: true,
      slot: true,
      customer: true,
      review: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Only the customer who placed it, or an admin, may view it — this
  // route returns the customer's name/email/delivery address (via the
  // `customer` include), so this check is a real privacy boundary, not
  // just a nicety. It was previously missing entirely: any order was
  // readable by anyone who knew or could guess its ID, logged in or not.
  if (order.customerId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
