import { NextResponse } from "next/server";
import { unexpectedErrorResponse } from "@/lib/api-errors";
import { declineOrder, OrderNotPendingError } from "@/lib/capacity";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user || user.role !== "RESTAURANT_OWNER") {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { restaurant: true },
  });
  if (!order || order.restaurant.ownerId !== user.id) {
    return NextResponse.json({ error: "Not authorized for this order" }, { status: 403 });
  }

  try {
    const declined = await declineOrder(id);
    return NextResponse.json({ order: declined });
  } catch (err) {
    if (err instanceof OrderNotPendingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return unexpectedErrorResponse(err, "Could not decline order");
  }
}
