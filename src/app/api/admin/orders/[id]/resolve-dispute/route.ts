import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, isFailure } from "@/lib/admin-auth";
import { resolveDispute, NotFoundError, AlreadyResolvedError } from "@/lib/admin";
import { RefundFailedError } from "@/lib/payments";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({
  resolution: z.enum(["release_payout", "refund"]),
  note: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin();
  if (isFailure(result)) return result.error;
  const { id } = await params;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid resolution is required" }, { status: 400 });
  }

  try {
    const order = await resolveDispute(id, parsed.data.resolution, parsed.data.note);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof AlreadyResolvedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof RefundFailedError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return unexpectedErrorResponse(err, "Could not resolve dispute");
  }
}
