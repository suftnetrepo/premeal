import { NextResponse } from "next/server";
import { unexpectedErrorResponse } from "@/lib/api-errors";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { reportProblem, OrderStatusError, NotAuthorizedError } from "@/lib/delivery";

const schema = z.object({ reason: z.string().min(1) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  }

  try {
    const order = await reportProblem(id, user.id, parsed.data.reason);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof NotAuthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof OrderStatusError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return unexpectedErrorResponse(err, "Could not report a problem on this order");
  }
}
