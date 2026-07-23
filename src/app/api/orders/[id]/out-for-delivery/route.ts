import { NextResponse } from "next/server";
import { unexpectedErrorResponse } from "@/lib/api-errors";
import { getCurrentUser } from "@/lib/auth";
import { markOutForDelivery, OrderStatusError, NotAuthorizedError } from "@/lib/delivery";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user || user.role !== "RESTAURANT_OWNER") {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const order = await markOutForDelivery(id, user.id);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof NotAuthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof OrderStatusError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return unexpectedErrorResponse(err, "Could not update order");
  }
}
