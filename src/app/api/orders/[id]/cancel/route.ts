import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cancelOrder, NotAuthorizedError, CannotCancelError } from "@/lib/cancellation";
import { RefundFailedError } from "@/lib/payments";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const order = await cancelOrder(id, user.id);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof NotAuthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof CannotCancelError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof RefundFailedError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return unexpectedErrorResponse(err, "Could not cancel this order");
  }
}
