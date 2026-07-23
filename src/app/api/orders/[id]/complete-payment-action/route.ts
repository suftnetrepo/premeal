import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { completePaymentAction, NotAuthorizedError, OrderStatusError } from "@/lib/payment-actions";
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
    const result = await completePaymentAction(id, user.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NotAuthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof OrderStatusError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return unexpectedErrorResponse(err, "Could not verify payment");
  }
}
