import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createReview, NotAuthorizedError, ReviewNotAllowedError } from "@/lib/reviews";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

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
    return NextResponse.json({ error: "A rating from 1-5 is required" }, { status: 400 });
  }

  try {
    const review = await createReview({
      orderId: id,
      customerId: user.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    if (err instanceof NotAuthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ReviewNotAllowedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return unexpectedErrorResponse(err, "Could not submit review");
  }
}
