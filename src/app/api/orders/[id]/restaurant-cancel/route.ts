import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { restaurantCancelOrder, NotAuthorizedError, CannotCancelError } from "@/lib/cancellation";
import { RefundFailedError } from "@/lib/payments";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({ reason: z.string().min(1) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user || user.role !== "RESTAURANT_OWNER") {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  }

  try {
    const order = await restaurantCancelOrder(id, user.id, parsed.data.reason);
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
