import { NextResponse } from "next/server";
import { unexpectedErrorResponse } from "@/lib/api-errors";
import { confirmOrder, OrderNotPendingError } from "@/lib/capacity";
import { PaymentRequiresActionError, ChargeFailedError } from "@/lib/payments";
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
    const confirmed = await confirmOrder(id);
    return NextResponse.json({ order: confirmed });
  } catch (err) {
    if (err instanceof OrderNotPendingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof PaymentRequiresActionError) {
      // Not really a failure from the restaurant's point of view — their
      // "accept" was recorded, the order just needs the customer to
      // approve the charge with their bank. 200, not an error status, so
      // the dashboard doesn't show this as something gone wrong.
      return NextResponse.json({
        awaitingCustomerVerification: true,
        message: "Accepted — waiting on the customer to verify their card with their bank.",
      });
    }
    if (err instanceof ChargeFailedError) {
      return NextResponse.json({ error: err.message }, { status: 402 });
    }
    return unexpectedErrorResponse(err, "Could not confirm order");
  }
}
